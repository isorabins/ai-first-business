# Google Drive File Indexer — Instructions for OpenClaw

Drop this file into your OpenClaw workspace (`~/clawd/` or wherever your agent reads from). Your agent will read it and know exactly how to index your Google Drive.

---

## What this does

Indexes every file across your Google Drive account(s) — documents, images, videos — using AI to summarize what each file contains. Writes searchable Markdown indexes your agent can query instantly. Once set up, you can ask your agent "find that invoice from March" or "what's in my Bali photos folder" and get a direct answer.

Runs as a background cron job on your OpenClaw server. Processes files in batches. Runs silently in the background without interrupting you.

---

## Instructions for your OpenClaw agent

When the user asks you to set up Drive indexing, follow this procedure. Write any code you need inline — do not expect pre-existing scripts.

---

### Phase 1 — Prerequisites

Check that these are available on the server:

```bash
which ffmpeg        # for video frame extraction
which pdftotext     # from poppler — for PDF text extraction  
python3 --version
pip3 show google-api-python-client 2>/dev/null || echo "not installed"
```

Install anything missing:

```bash
# Ubuntu/Debian
apt install -y ffmpeg poppler-utils
pip3 install google-auth google-auth-oauthlib google-api-python-client requests
```

---

### Phase 2 — Google OAuth

⚠️ **VPS note:** This server likely has no browser. Do NOT use `run_local_server()` for OAuth. Use the out-of-band (OOB) copy/paste flow instead.

Write and run this auth script:

```python
# /tmp/drive-auth.py — run once per account
from google_auth_oauthlib.flow import InstalledAppFlow
import json, pathlib, sys

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
email = sys.argv[1]
creds_file = pathlib.Path.home() / '.credentials/client-credentials.json'
token_dir = pathlib.Path.home() / '.credentials/email-tokens'
token_dir.mkdir(parents=True, exist_ok=True)
token_file = token_dir / f'{email.replace("@","_at_").replace(".","_")}.json'

if not creds_file.exists():
    print(f"ERROR: credentials file not found at {creds_file}")
    print("Ask the user to paste their Google Cloud OAuth credentials JSON.")
    sys.exit(1)

flow = InstalledAppFlow.from_client_secrets_file(str(creds_file), SCOPES)

# Use OOB flow — generates a URL the user visits, then pastes the code back
flow.redirect_uri = 'urn:ietf:wg:oauth:2.0:oob'
auth_url, _ = flow.authorization_url(prompt='consent')

print(f"\nVisit this URL in your browser:\n{auth_url}\n")
code = input("Paste the authorization code here: ").strip()

flow.fetch_token(code=code)
token_file.write_text(flow.credentials.to_json())
print(f"\nToken saved to {token_file}")
```

**Ask the user to:**
1. Get OAuth credentials from Google Cloud Console (Drive API enabled, Desktop app type) and save as `~/.credentials/client-credentials.json`
2. Run: `python3 /tmp/drive-auth.py their@gmail.com`
3. Visit the URL it prints, authorize in browser, paste the code back

Repeat for each Drive account.

**If the user already has Gmail OAuth tokens from OpenClaw setup:**
Check `~/.credentials/email-tokens/` — if JSON files exist there, they may already work. Try them; if they're missing the Drive scope, run the auth script above.

---

### Phase 3 — Build the indexer script

Write the following script at `~/clawd/scripts/file-summarizer.py`. This script does all the work.

```python
#!/usr/bin/env python3
"""
Google Drive File Summarizer
Indexes all Drive files with AI-generated summaries.
Saves progress after each file — safe to interrupt and restart.
"""

import os, sys, json, time, pathlib, subprocess, tempfile, argparse
from datetime import datetime

# ── CONFIG (edit these) ──────────────────────────────────────────────────
TOKEN_DIR   = pathlib.Path.home() / ".credentials/email-tokens"
INDEX_DIR   = pathlib.Path.home() / "clawd/memory/drive-indexes"
STATE_FILE  = pathlib.Path.home() / "clawd/tasks/file-summarizer-state.json"

# AI endpoint — OpenClaw gateway (no external API cost)
# Get gateway token from ~/.openclaw/openclaw.json → look for gateway.secret or gateway.token
AI_URL   = os.getenv("AI_URL",   "http://127.0.0.1:18789/v1/chat/completions")
AI_TOKEN = os.getenv("AI_TOKEN", "REPLACE_WITH_GATEWAY_TOKEN")
AI_MODEL = os.getenv("AI_MODEL", "gpt-4o-mini")

# Drive accounts to index: { label: token_filename }
ACCOUNTS = {
    # "personal": "isorabins_gmail_com.json",
    # "work":     "work_at_example_com.json",
    # Add your accounts here — token files in TOKEN_DIR
}
# ── END CONFIG ────────────────────────────────────────────────────────────

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import requests, io, base64

INDEX_DIR.mkdir(parents=True, exist_ok=True)
STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"completed_ids": {}, "errors": {}, "queues": {}}

def save_state(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))

def get_service(token_file):
    creds = Credentials.from_authorized_user_file(str(TOKEN_DIR / token_file))
    return build("drive", "v3", credentials=creds)

def list_all_files(service):
    """List all files in Drive with pagination."""
    files = []
    page_token = None
    while True:
        resp = service.files().list(
            pageSize=1000,
            fields="nextPageToken,files(id,name,mimeType,size,modifiedTime,parents)",
            pageToken=page_token,
            includeItemsFromAllDrives=True,
            supportsAllDrives=True
        ).execute()
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files

def call_ai(prompt, image_b64=None):
    """Call the AI gateway for a summary."""
    messages = [{"role": "user", "content": []}]
    if image_b64:
        messages[0]["content"].append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}
        })
    messages[0]["content"].append({"type": "text", "text": prompt})
    if not image_b64:
        messages[0]["content"] = prompt  # simpler for text-only

    try:
        r = requests.post(AI_URL, json={
            "model": AI_MODEL,
            "messages": messages,
            "max_tokens": 150
        }, headers={"Authorization": f"Bearer {AI_TOKEN}"}, timeout=30)
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return None

def summarize_file(service, f):
    """Return (summary, skipped_reason) for a Drive file."""
    mime = f.get("mimeType", "")
    name = f.get("name", "")
    fid  = f.get("id", "")

    EXPORT_MIME = {
        "application/vnd.google-apps.document":     "text/plain",
        "application/vnd.google-apps.spreadsheet":  "text/csv",
        "application/vnd.google-apps.presentation": "text/plain",
    }
    TEXT_MIME = ["text/plain", "text/csv", "application/pdf",
                 "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    IMAGE_MIME = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"]
    VIDEO_MIME = ["video/mp4", "video/quicktime", "video/avi", "video/x-matroska"]

    try:
        if mime in EXPORT_MIME:
            req = service.files().export_media(fileId=fid, mimeType=EXPORT_MIME[mime])
        elif any(t in mime for t in ["text/", "pdf", "word"]):
            req = service.files().get_media(fileId=fid)
        elif any(t in mime for t in IMAGE_MIME):
            req = service.files().get_media(fileId=fid)
        elif any(t in mime for t in VIDEO_MIME):
            req = service.files().get_media(fileId=fid)
        else:
            return None, "unsupported type"

        buf = io.BytesIO()
        dl = MediaIoBaseDownload(buf, req)
        done = False
        while not done:
            _, done = dl.next_chunk()
        data = buf.getvalue()

        if any(t in mime for t in IMAGE_MIME):
            # Resize if large, then call vision
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                tmp.write(data)
                tmp_path = tmp.name
            try:
                out = subprocess.run(
                    ["ffmpeg", "-y", "-i", tmp_path, "-vf", "scale=512:-1", "/tmp/thumb.jpg"],
                    capture_output=True, timeout=15
                )
                img_data = pathlib.Path("/tmp/thumb.jpg").read_bytes() if out.returncode == 0 else data
            except:
                img_data = data
            finally:
                os.unlink(tmp_path)
            b64 = base64.b64encode(img_data[:500000]).decode()
            summary = call_ai("Describe what's shown in this image in exactly one sentence.", b64)

        elif any(t in mime for t in VIDEO_MIME):
            with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
                tmp.write(data[:10_000_000])  # limit 10MB
                tmp_path = tmp.name
            try:
                subprocess.run(
                    ["ffmpeg", "-y", "-i", tmp_path, "-ss", "1", "-vframes", "1", "/tmp/vidthumb.jpg"],
                    capture_output=True, timeout=15
                )
                if pathlib.Path("/tmp/vidthumb.jpg").exists():
                    b64 = base64.b64encode(pathlib.Path("/tmp/vidthumb.jpg").read_bytes()).decode()
                    summary = call_ai("Describe what's shown in this video frame in one sentence.", b64)
                else:
                    summary = None
            except:
                summary = None
            finally:
                os.unlink(tmp_path)

        else:
            # Text-based
            if "pdf" in mime:
                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(data)
                    tmp_path = tmp.name
                try:
                    result = subprocess.run(["pdftotext", "-l", "5", tmp_path, "-"],
                                            capture_output=True, text=True, timeout=15)
                    text = result.stdout[:8000] if result.returncode == 0 else data.decode("utf-8", errors="ignore")[:8000]
                except:
                    text = data.decode("utf-8", errors="ignore")[:8000]
                finally:
                    os.unlink(tmp_path)
            else:
                text = data.decode("utf-8", errors="ignore")[:8000]

            if not text.strip():
                return None, "empty content"
            summary = call_ai(
                f"This is a file called '{name}'. "
                f"Write a 2-sentence summary: what is it, who's involved, key dates/amounts/decisions.\n\n{text}",
            )

        return summary, None

    except Exception as e:
        return None, str(e)[:100]


def run(batch_size=20, dry_run=False, init_only=False, status_only=False):
    state = load_state()

    if status_only:
        for label in ACCOUNTS:
            queue = state["queues"].get(label, [])
            done = len(state["completed_ids"].get(label, {}))
            total = done + len(queue)
            pct = int(done/total*100) if total else 0
            print(f"{label}: {done}/{total} ({pct}%) done | {len(state['errors'].get(label,{}))} errors")
        return

    for label, token_file in ACCOUNTS.items():
        print(f"\n── {label} ──────────────────────────────")
        try:
            service = get_service(token_file)
        except Exception as e:
            print(f"  ERROR loading token: {e}")
            continue

        # Init: rebuild queue from Drive
        if init_only or label not in state["queues"]:
            print(f"  Scanning Drive...")
            files = list_all_files(service)
            completed = state["completed_ids"].get(label, {})
            queue = [f["id"] for f in files if f["id"] not in completed]
            state["queues"][label] = queue
            state.setdefault("file_meta", {})[label] = {f["id"]: f for f in files}
            save_state(state)
            print(f"  Found {len(files)} files. {len(queue)} to process.")
            if init_only:
                continue

        queue = state["queues"].get(label, [])
        completed = state["completed_ids"].setdefault(label, {})
        meta = state.get("file_meta", {}).get(label, {})
        errors = state["errors"].setdefault(label, {})
        index_file = INDEX_DIR / f"{label}.md"

        # Load existing index entries
        existing_rows = {}
        if index_file.exists():
            for line in index_file.read_text().splitlines():
                if line.startswith("| ") and " | " in line:
                    parts = [p.strip() for p in line.split(" | ")]
                    if len(parts) >= 5 and parts[0] != "File":
                        existing_rows[parts[0]] = line

        processed = 0
        while queue and processed < batch_size:
            fid = queue.pop(0)
            f = meta.get(fid, {"id": fid, "name": fid, "mimeType": "unknown"})
            name = f.get("name", fid)
            mime = f.get("mimeType", "")
            size = int(f.get("size", 0))
            modified = f.get("modifiedTime", "")[:10]

            if dry_run:
                print(f"  [DRY RUN] Would process: {name}")
                processed += 1
                continue

            print(f"  [{processed+1}/{batch_size}] {name[:60]}...", end=" ", flush=True)
            summary, skip_reason = summarize_file(service, f)

            if summary:
                completed[fid] = {"name": name, "summary": summary, "modified": modified}
                summary_display = summary.replace("|", " ").replace("\n", " ")
                size_str = f"{size//1024}KB" if size > 1024 else f"{size}B" if size else "-"
                print(f"✓")
            else:
                errors[fid] = skip_reason or "no summary"
                completed[fid] = {"name": name, "summary": f"({skip_reason or 'not summarized'})", "modified": modified}
                print(f"– skipped ({skip_reason})")

            state["queues"][label] = queue
            save_state(state)
            processed += 1

        # Write index file
        rows_by_folder = {}
        for fid, info in completed.items():
            f = meta.get(fid, {})
            parents = f.get("parents", ["(root)"])
            folder_id = parents[0] if parents else "(root)"
            folder_name = meta.get(folder_id, {}).get("name", folder_id)
            rows_by_folder.setdefault(folder_name, []).append(info)

        with open(index_file, "w") as out:
            out.write(f"# {label.title()} Drive — File Index\n")
            out.write(f"*Updated: {datetime.now().strftime('%Y-%m-%d')} | {len(completed)} files*\n\n")
            for folder, items in sorted(rows_by_folder.items()):
                out.write(f"\n## {folder}/ ({len(items)} files)\n")
                out.write("| File | Modified | Summary |\n|------|----------|--------|\n")
                for item in sorted(items, key=lambda x: x.get("name","")):
                    name_clean = item["name"].replace("|"," ")
                    summary_clean = item["summary"].replace("|"," ").replace("\n"," ")[:150]
                    out.write(f"| {name_clean} | {item.get('modified','')} | {summary_clean} |\n")

        remaining = len(queue)
        print(f"\n  Done. {processed} processed. {remaining} remaining in queue.")
        if remaining > 0:
            print(f"  Run again to continue (or set up cron).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--init", action="store_true", help="Scan Drive and build queue (no AI calls)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed, no API calls")
    parser.add_argument("--status", action="store_true", help="Show progress stats")
    parser.add_argument("--batch-size", type=int, default=20, help="Files to process per run")
    args = parser.parse_args()

    if not ACCOUNTS:
        print("ERROR: No accounts configured. Edit the ACCOUNTS dict at the top of this script.")
        sys.exit(1)

    run(batch_size=args.batch_size, dry_run=args.dry_run,
        init_only=args.init, status_only=args.status)
```

---

### Phase 4 — Configure and run

Edit the `ACCOUNTS` section at the top of the script to add the user's accounts.

Get the gateway token:

```bash
cat ~/.openclaw/openclaw.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gateway',{}).get('secret','') or d.get('gateway',{}).get('token',''))"
```

Then initialize and run:

```bash
# Set env vars
export AI_TOKEN="gateway-token-here"

# Scan Drive and build queue (no AI calls yet)
python3 ~/clawd/scripts/file-summarizer.py --init

# Check what will be processed
python3 ~/clawd/scripts/file-summarizer.py --dry-run --batch-size 5

# First real batch
python3 ~/clawd/scripts/file-summarizer.py --batch-size 30

# Check progress
python3 ~/clawd/scripts/file-summarizer.py --status
```

---

### Phase 5 — Set up the cron job

Use the OpenClaw cron tool to create a job:

- **Schedule:** every 30 minutes
- **Task:** `AI_TOKEN=gateway-token python3 ~/clawd/scripts/file-summarizer.py --batch-size 20`

Once all files are summarized, switch to weekly maintenance:

- **Schedule:** every Sunday at 2am
- **Task:** `AI_TOKEN=gateway-token python3 ~/clawd/scripts/file-summarizer.py --init && python3 ~/clawd/scripts/file-summarizer.py --batch-size 500`

---

### Phase 6 — Wire into your agent

Create `DRIVE-MAP.md` in the workspace root:

```markdown
# DRIVE-MAP — Where Everything Lives

Start here when looking for any file. Do NOT search Drive without checking this first.

## Accounts

### main@example.com
Index: memory/drive-indexes/main.md

### personal@gmail.com
Index: memory/drive-indexes/personal.md

## How to find a file
1. Read DRIVE-MAP.md (this file)
2. Pick the right index
3. Search the Summary column for keywords
4. Return exact filename + path to the user
```

Add to `AGENTS.md` startup:

```
- File lookup: read DRIVE-MAP.md → pick index → find the file
- Never ask where something is without checking the index first
```

---

## Realistic expectations

| Drive size | First run time | API cost |
|-----------|---------------|---------|
| 1,000 files | ~1 hour | ~$0.50–2 |
| 5,000 files | ~5 hours | ~$3–10 |
| 20,000+ files | overnight | ~$10–40 |

Use `gpt-4o-mini` — cheap and plenty capable for summarization.

**With OpenClaw's Codex gateway (ChatGPT Pro):** Zero API cost. This is how we ran 37,000 files for free.

---

## Troubleshooting

**"No browser" error during OAuth:** Make sure the auth script uses the OOB flow (`redirect_uri = 'urn:ietf:wg:oauth:2.0:oob'`), not `run_local_server()`. The OOB flow prints a URL — user visits it, pastes code back.

**Token expired:** Re-run `/tmp/drive-auth.py` for that account.

**Rate limited by Google Drive API:** The script adds a small delay between requests. If you hit quota limits, reduce `--batch-size` to 10.

**Cron not running:** Use `openclaw cron list` to verify.

---

*Part of the [ai-first-business](https://github.com/isorabins/ai-first-business) project.*
*Follow the build: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
