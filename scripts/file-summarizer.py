#!/usr/bin/env python3
"""
File Summarizer — AI-powered Google Drive index builder.

Downloads files from Google Drive, summarizes them using AI vision/text models,
and writes searchable Markdown index files your AI can read.

Works with Claude Code (desktop), Claude Projects, OpenClaw, or any AI that
can read files from your workspace.

Usage:
    python3 file-summarizer.py --init          # scan Drive, build work queue
    python3 file-summarizer.py                  # process next batch
    python3 file-summarizer.py --batch-size 50  # process larger batches
    python3 file-summarizer.py --dry-run        # preview without API calls
    python3 file-summarizer.py --status         # show progress

Requirements:
    pip install google-auth google-auth-oauthlib google-api-python-client requests
    brew install ffmpeg poppler  # Mac
    apt install ffmpeg poppler-utils  # Linux

See README.md for full setup instructions.
"""

import json
import os
import sys
import subprocess
import argparse
import base64
import io
from datetime import datetime, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# =============================================================================
# CONFIGURATION — edit these to match your setup
# =============================================================================

# Where your OAuth token files live (one JSON per Drive account)
# Run auth-setup.py to create these
TOKEN_DIR = Path("./tokens")

# Where index files get written (your AI reads from here)
INDEX_DIR = Path("./drive-indexes")

# Checkpoint file — tracks progress so you can stop/restart anytime
STATE_FILE = Path("./summarizer-state.json")

# Temp dir for file processing (auto-cleaned after each file)
TEMP_DIR = Path("/tmp/file-summarizer")

# Your Drive accounts — add one entry per account you want to index
ACCOUNTS = {
    # The key is used as the index filename (e.g. "work" → drive-indexes/work.md)
    "work": {
        "token": "work_token.json",        # filename inside TOKEN_DIR
        "email": "me@example.com",         # just for display
        "label": "Work Drive",             # display name in index headers
    },
    # Add more accounts here:
    # "personal": {
    #     "token": "personal_token.json",
    #     "email": "personal@gmail.com",
    #     "label": "Personal",
    # },
}

# AI endpoint — any OpenAI-compatible API works
# Option 1: OpenAI directly
AI_API_URL = "https://api.openai.com/v1/chat/completions"
AI_API_KEY = os.environ.get("OPENAI_API_KEY", "your-api-key-here")
AI_MODEL = "gpt-4o-mini"   # cheap + fast, good enough for summarization

# Option 2: Anthropic (uncomment and comment out Option 1)
# AI_API_URL = "https://api.anthropic.com/v1/messages"
# AI_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "your-key-here")
# AI_MODEL = "claude-3-haiku-20240307"

# Option 3: OpenClaw gateway (if you're running OpenClaw)
# AI_API_URL = "http://127.0.0.1:18789/v1/chat/completions"
# AI_API_KEY = "your-openclaw-gateway-token"
# AI_MODEL = "gpt-4o-mini"

# =============================================================================
# File type config — you probably don't need to change this
# =============================================================================

VIDEO_MIMES = {
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'video/3gpp', 'video/webm', 'video/mpeg',
}
VIDEO_EXTS = {'.mov', '.mp4', '.avi', '.mkv', '.m4v', '.3gp', '.webm', '.mpeg', '.mpg'}

IMAGE_MIMES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/tiff',
}

DOC_MIMES = {
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

# Files to skip (medical scans, system files, etc.)
SKIP_PATTERNS = [
    'dicom', '.dcm', 'autorun', '.dll', '.sys',
    'node_modules', '.git', 'package-lock',
]

# =============================================================================
# Helpers
# =============================================================================

def load_state():
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return {"status": "idle", "accounts": {}}


def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def get_drive_service(token_path):
    with open(token_path) as f:
        token_data = json.load(f)
    creds = Credentials(
        token=token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id"),
        client_secret=token_data.get("client_secret"),
    )
    # Auto-refresh if expired
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_data["token"] = creds.token
        with open(token_path, "w") as f:
            json.dump(token_data, f, indent=2)
    return build("drive", "v3", credentials=creds)


def should_skip(filename):
    lower = filename.lower()
    return any(p in lower for p in SKIP_PATTERNS)


def is_video(filename, mime_type):
    ext = Path(filename).suffix.lower()
    return mime_type in VIDEO_MIMES or ext in VIDEO_EXTS


def is_image(filename, mime_type):
    return mime_type in IMAGE_MIMES


def is_doc(filename, mime_type):
    return mime_type in DOC_MIMES


def format_size(size_bytes):
    if size_bytes is None:
        return "—"
    size = int(size_bytes)
    if size < 1024:
        return f"{size} B"
    elif size < 1024**2:
        return f"{size / 1024:.0f} KB"
    elif size < 1024**3:
        return f"{size / 1024**2:.1f} MB"
    else:
        return f"{size / 1024**3:.1f} GB"


def download_file(service, file_id, dest_path, mime_type=None):
    try:
        if mime_type and mime_type.startswith('application/vnd.google-apps.'):
            return False
        request = service.files().get_media(fileId=file_id)
        fh = io.FileIO(str(dest_path), 'wb')
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        fh.close()
        return True
    except Exception as e:
        print(f"download error: {e}", end=" ")
        return False


# =============================================================================
# AI calls
# =============================================================================

class RateLimitError(Exception):
    pass


def ai_complete(messages, max_tokens=200):
    """Send a completion request to the configured AI endpoint."""
    import urllib.request
    import urllib.error

    payload = json.dumps({
        "model": AI_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
    }).encode()

    req = urllib.request.Request(
        AI_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AI_API_KEY}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            if "choices" in data and data["choices"]:
                return data["choices"][0]["message"]["content"].strip()
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimitError("Rate limited (429)")
        body = e.read().decode()
        print(f"HTTP {e.code}: {body[:80]}", end=" ")
    except Exception as e:
        print(f"AI error: {e}", end=" ")
    return None


def get_vision_summary(image_path, filename, folder):
    """Send an image to the vision model for a 1-sentence description."""
    image_path = Path(image_path)
    jpeg_path = TEMP_DIR / "vision_input.jpg"

    # Convert to JPEG, resize to max 1920px on longest side
    try:
        subprocess.run([
            'ffmpeg', '-y', '-i', str(image_path),
            '-vf', "scale='min(1920,iw)':'min(1920,ih)':force_original_aspect_ratio=decrease",
            '-q:v', '4',
            str(jpeg_path)
        ], capture_output=True, timeout=30, check=True)
    except Exception:
        # Fall back to raw file if ffmpeg fails
        size = image_path.stat().st_size
        if size > 4 * 1024 * 1024:
            return None
        jpeg_path = image_path

    if not jpeg_path.exists():
        return None

    if jpeg_path.stat().st_size > 4.5 * 1024 * 1024:
        return None

    with open(jpeg_path, 'rb') as f:
        img_data = base64.b64encode(f.read()).decode()

    if jpeg_path != image_path:
        jpeg_path.unlink(missing_ok=True)

    return ai_complete([{
        "role": "user",
        "content": [
            {"type": "text", "text": (
                f"This is a file called '{filename}' from the folder '{folder}'. "
                f"Describe what's shown in one sentence. Be specific: people, activities, "
                f"setting, food if relevant."
            )},
            {"type": "image_url", "image_url": {
                "url": f"data:image/jpeg;base64,{img_data}"
            }}
        ]
    }], max_tokens=100)


def get_text_summary(service, file_id, mime_type, filename):
    """Extract document text and summarize it."""
    try:
        full_text = None

        if mime_type == 'application/vnd.google-apps.document':
            content = service.files().export(fileId=file_id, mimeType='text/plain').execute()
            full_text = content.decode('utf-8') if isinstance(content, bytes) else str(content)
        elif mime_type == 'application/vnd.google-apps.spreadsheet':
            content = service.files().export(fileId=file_id, mimeType='text/csv').execute()
            full_text = content.decode('utf-8') if isinstance(content, bytes) else str(content)
        elif mime_type == 'application/vnd.google-apps.presentation':
            content = service.files().export(fileId=file_id, mimeType='text/plain').execute()
            full_text = content.decode('utf-8') if isinstance(content, bytes) else str(content)
        elif mime_type == 'application/pdf':
            pdf_path = TEMP_DIR / "doc.pdf"
            if download_file(service, file_id, pdf_path, mime_type):
                result = subprocess.run(
                    ['pdftotext', '-l', '5', str(pdf_path), '-'],
                    capture_output=True, text=True, timeout=30
                )
                if result.returncode == 0 and result.stdout.strip():
                    full_text = result.stdout
                pdf_path.unlink(missing_ok=True)
        elif mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            docx_path = TEMP_DIR / "doc.docx"
            if download_file(service, file_id, docx_path, mime_type):
                try:
                    import docx as python_docx
                    doc = python_docx.Document(str(docx_path))
                    full_text = '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
                except Exception as e:
                    print(f"docx error: {e}", end=" ")
                docx_path.unlink(missing_ok=True)
        else:
            return None

        if not full_text or len(full_text.strip()) < 10:
            return "(Empty document)"

        return ai_complete([{
            "role": "user",
            "content": (
                f"File: '{filename}'. Write a 2-3 sentence summary: what it's about, "
                f"who's involved, key details (dates, amounts, decisions).\n\n"
                f"---\n{full_text.strip()[:15000]}\n---"
            )
        }], max_tokens=200)

    except Exception as e:
        print(f"text error: {e}", end=" ")
    return None


# =============================================================================
# Init — scan Drive and build work queue
# =============================================================================

def init_account(account_key, account_info):
    token_path = TOKEN_DIR / account_info["token"]
    if not token_path.exists():
        print(f"  ⚠️  Token not found: {token_path}")
        print(f"      Run: python3 auth-setup.py {account_info['email']}")
        return None

    print(f"  Scanning {account_info['email']}...")
    service = get_drive_service(token_path)

    # List all non-folder files
    all_files = []
    page_token = None
    while True:
        resp = service.files().list(
            q="trashed = false and mimeType != 'application/vnd.google-apps.folder'",
            fields="nextPageToken, files(id, name, mimeType, size, parents)",
            pageSize=1000,
            pageToken=page_token,
        ).execute()
        all_files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    print(f"  Found {len(all_files)} files total")

    # Build folder map for path resolution
    folders = {}
    page_token = None
    while True:
        resp = service.files().list(
            q="mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields="nextPageToken, files(id, name, parents)",
            pageSize=1000,
            pageToken=page_token,
        ).execute()
        for f in resp.get("files", []):
            folders[f["id"]] = {"name": f["name"], "parents": f.get("parents", [])}
        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    def resolve_path(parents, depth=0):
        if not parents or depth > 5:
            return "(root)"
        pid = parents[0]
        if pid not in folders:
            return "(root)"
        info = folders[pid]
        parent_path = resolve_path(info.get("parents", []), depth + 1)
        if parent_path and parent_path != "(root)":
            return f"{parent_path}/{info['name']}"
        return info["name"]

    # Filter to summarizable file types
    work_queue = []
    for f in all_files:
        name = f["name"]
        mime = f.get("mimeType", "")
        if should_skip(name):
            continue
        if is_video(name, mime) or is_image(name, mime) or is_doc(name, mime):
            work_queue.append({
                "id": f["id"],
                "name": name,
                "path": resolve_path(f.get("parents", [])),
                "mimeType": mime,
                "size": f.get("size"),
                "type": "video" if is_video(name, mime) else "image" if is_image(name, mime) else "doc",
            })

    print(f"  {len(work_queue)} files to summarize (images, videos, docs)")
    return {"total_files": len(all_files), "summarizable": len(work_queue), "queue": work_queue}


# =============================================================================
# Process — summarize one batch
# =============================================================================

def process_batch(account_key, account_info, state, batch_size=20, dry_run=False):
    acct_state = state["accounts"].get(account_key, {})
    if acct_state.get("status") != "running":
        return

    # Respect rate limit cooldowns
    cooldown = acct_state.get("cooldown_until")
    if cooldown:
        from datetime import timedelta
        cooldown_dt = datetime.fromisoformat(cooldown)
        if datetime.now(timezone.utc) < cooldown_dt:
            remaining = (cooldown_dt - datetime.now(timezone.utc)).total_seconds() / 3600
            print(f"  ⏸️  Rate limit cooldown — {remaining:.1f}h remaining. Try again later.")
            return
        del acct_state["cooldown_until"]

    queue = acct_state.get("queue", [])
    completed = set(acct_state.get("completed_ids", []))
    summaries = acct_state.get("summaries", {})
    errors = acct_state.get("errors", [])

    pending = [f for f in queue if f["id"] not in completed]
    batch = pending[:batch_size]

    if not batch:
        print(f"  ✅ All done!")
        acct_state["status"] = "completed"
        save_state(state)
        return

    print(f"  Processing {len(batch)} files ({len(completed)}/{len(queue)} complete)...")

    if dry_run:
        for f in batch:
            print(f"    [DRY] {f['type']}: {f['path']}/{f['name']}")
        return

    token_path = TOKEN_DIR / account_info["token"]
    service = get_drive_service(token_path)
    TEMP_DIR.mkdir(parents=True, exist_ok=True)

    for f in batch:
        file_id, name, path, mime, ftype = f["id"], f["name"], f["path"], f["mimeType"], f["type"]
        print(f"    [{ftype}] {name[:50]}...", end=" ", flush=True)

        summary = None
        try:
            if ftype == "video":
                size = int(f.get("size", 0) or 0)
                if size > 500 * 1024 * 1024:
                    summary = f"(Large video, {format_size(size)} — skipped)"
                    print("skipped (too large)")
                else:
                    ext = Path(name).suffix.lower() or '.mov'
                    video_path = TEMP_DIR / f"video{ext}"
                    thumb_path = TEMP_DIR / "thumb.jpg"
                    if download_file(service, file_id, video_path, mime):
                        # Extract frame at 1 second (safe for short clips)
                        subprocess.run([
                            'ffmpeg', '-i', str(video_path), '-ss', '1',
                            '-frames:v', '1', '-q:v', '2', '-y', str(thumb_path)
                        ], capture_output=True, timeout=30)
                        if thumb_path.exists():
                            summary = get_vision_summary(thumb_path, name, path)
                        video_path.unlink(missing_ok=True)
                        thumb_path.unlink(missing_ok=True)
                    print(f"✅ {summary[:60]}..." if summary else "⚠️ failed")

            elif ftype == "image":
                ext = Path(name).suffix.lower() or '.jpg'
                img_path = TEMP_DIR / f"image{ext}"
                if download_file(service, file_id, img_path, mime):
                    summary = get_vision_summary(img_path, name, path)
                    img_path.unlink(missing_ok=True)
                    (TEMP_DIR / "vision_input.jpg").unlink(missing_ok=True)
                print(f"✅ {summary[:60]}..." if summary else "⚠️ failed")

            elif ftype == "doc":
                summary = get_text_summary(service, file_id, mime, name)
                print(f"✅ {summary[:60]}..." if summary else "⚠️ failed")

        except RateLimitError:
            print("⏸️  Rate limited — setting 24h cooldown")
            from datetime import timedelta
            acct_state["cooldown_until"] = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            acct_state["completed_ids"] = list(completed)
            acct_state["summaries"] = summaries
            save_state(state)
            return
        except Exception as e:
            print(f"❌ {e}")
            errors.append({"id": file_id, "name": name, "error": str(e)})

        # Checkpoint after every file
        summaries[file_id] = {
            "name": name, "path": path, "type": ftype,
            "size": f.get("size"),
            "summary": summary or f"({ftype}: {name})",
        }
        completed.add(file_id)
        acct_state["completed_ids"] = list(completed)
        acct_state["summaries"] = summaries
        acct_state["errors"] = errors
        acct_state["last_run"] = datetime.now(timezone.utc).isoformat()
        save_state(state)

    write_companion_index(account_key, account_info, summaries)
    remaining = len(queue) - len(completed)
    print(f"\n  Batch done. {len(completed)}/{len(queue)} complete, {remaining} remaining.")
    if remaining == 0:
        acct_state["status"] = "completed"
        save_state(state)
        print(f"  🎉 {account_info['label']} fully indexed!")


def write_companion_index(account_key, account_info, summaries):
    """Write the companion -files.md index with AI summaries, grouped by folder."""
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    output_path = INDEX_DIR / f"{account_key}-files.md"
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    lines = [
        f"# {account_info['label']} — File Summaries",
        f"",
        f"*Account: {account_info['email']} | Updated: {now_str} | {len(summaries)} files*",
        f"*Companion index — contains AI-generated per-file descriptions.*",
        f"",
    ]

    by_folder = {}
    for fid, info in summaries.items():
        folder = info["path"]
        by_folder.setdefault(folder, []).append(info)

    for folder in sorted(by_folder.keys()):
        files = sorted(by_folder[folder], key=lambda x: x["name"].lower())
        lines += [f"## {folder}/ ({len(files)} files)", "", "| File | Type | Size | Summary |", "|------|------|------|---------|"]
        for f in files:
            name = f["name"][:47] + "..." if len(f["name"]) > 50 else f["name"]
            summary = (f.get("summary") or "—").replace("|", "/").replace("\n", " ")[:97]
            lines.append(f"| {name} | {f['type']} | {format_size(f.get('size'))} | {summary} |")
        lines.append("")

    output_path.write_text("\n".join(lines))
    print(f"  Wrote {output_path}")


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="AI-powered Google Drive file summarizer")
    parser.add_argument("--init", action="store_true", help="Scan Drive and build work queue")
    parser.add_argument("--status", action="store_true", help="Show progress")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--account", type=str, help="Only process one account key")
    parser.add_argument("--dry-run", action="store_true", help="Preview without API calls")
    args = parser.parse_args()

    state = load_state()

    if args.status:
        print(f"\n=== File Summarizer Status ===\n")
        print(f"Overall: {state.get('status', 'idle')}")
        for key, acct in state.get("accounts", {}).items():
            total = len(acct.get("queue", []))
            done = len(acct.get("completed_ids", []))
            errors = len(acct.get("errors", []))
            pct = f"{done/total*100:.0f}%" if total else "—"
            print(f"  {key}: {done}/{total} ({pct}) [{acct.get('status','?')}] — {errors} errors")
        print()
        return

    if args.init:
        print(f"\n=== Initializing File Summarizer ===\n")
        targets = {args.account: ACCOUNTS[args.account]} if args.account else ACCOUNTS
        for key, info in targets.items():
            print(f"[{info['label']}]")
            result = init_account(key, info)
            if result:
                state["accounts"][key] = {
                    "status": "running",
                    "queue": result["queue"],
                    "completed_ids": [],
                    "summaries": {},
                    "errors": [],
                    "total_files": result["total_files"],
                    "summarizable": result["summarizable"],
                    "initialized_at": datetime.now(timezone.utc).isoformat(),
                }
            print()
        state["status"] = "running"
        save_state(state)
        print(f"Initialized. Run without --init to start processing.\n")
        return

    # Normal run
    print(f"\n=== File Summarizer — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===\n")
    targets = {args.account: ACCOUNTS[args.account]} if args.account else ACCOUNTS
    for key, info in targets.items():
        if key not in state.get("accounts", {}):
            print(f"[{info['label']}] Not initialized — run with --init first")
            continue
        if state["accounts"][key].get("status") != "running":
            print(f"[{info['label']}] Status: {state['accounts'][key].get('status')} — skipping")
            continue
        print(f"[{info['label']}]")
        process_batch(key, info, state, batch_size=args.batch_size, dry_run=args.dry_run)
        print()

    all_done = all(
        a.get("status") in ("completed",) for a in state.get("accounts", {}).values()
    )
    if all_done:
        state["status"] = "completed"
        save_state(state)
        print("🎉 All accounts complete! Your drive-indexes/ folder is ready.")
    print("Done.")


if __name__ == "__main__":
    main()
