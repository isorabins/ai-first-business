# Google Drive File Indexer — Instructions for OpenClaw

Drop this file into your OpenClaw workspace (`~/clawd/` or wherever your agent reads from). Your agent will read it and know exactly how to index your Google Drive.

---

## What this does

Indexes every file across your Google Drive account(s) — documents, images, videos — using AI to summarize what each file contains. Writes searchable Markdown indexes your agent can query instantly. Once set up, you can ask your agent "find that invoice from March" or "what's in my Bali photos folder" and get a direct answer.

This runs as a background cron job on your OpenClaw server and processes files in batches without interrupting you.

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
pip3 install google-auth google-auth-oauthlib google-api-python-client

# macOS
brew install ffmpeg poppler
pip3 install google-auth google-auth-oauthlib google-api-python-client
```

---

### Phase 2 — Google OAuth

The user needs to authorize their Google Drive account(s). Do this once per account.

**Ask the user:** "Do you already have a Google Cloud project with Drive API enabled? If not, I'll walk you through creating one."

If they need to create credentials:
1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable Drive API: APIs & Services → Library → Google Drive API → Enable
4. Create credentials: APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID → Desktop app
5. Download the JSON — save as `client-credentials.json` in `~/.credentials/`

Once they have credentials, write and run a quick OAuth script to get a refresh token:

```python
# save as /tmp/drive-auth.py — run once per account
from google_auth_oauthlib.flow import InstalledAppFlow
import json, pathlib, sys

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CREDS_FILE = pathlib.Path.home() / '.credentials/client-credentials.json'
email = sys.argv[1]  # pass email as argument
token_file = pathlib.Path.home() / f'.credentials/email-tokens/{email.replace("@","_at_").replace(".","_")}.json'
token_file.parent.mkdir(exist_ok=True)

flow = InstalledAppFlow.from_client_secrets_file(str(CREDS_FILE), SCOPES)
creds = flow.run_local_server(port=0)
token_file.write_text(creds.to_json())
print(f"Token saved to {token_file}")
```

Run: `python3 /tmp/drive-auth.py their@gmail.com`

This opens a browser window. They log in and click allow. Token saved. Repeat for each account.

---

### Phase 3 — Build the indexer script

Write a Python script at `~/clawd/scripts/file-summarizer.py`. The script should:

1. **Connect to Google Drive** using the token files from Phase 2
2. **Walk the full file tree** — all folders, all files, recursively
3. **For each file:**
   - Record: name, path, MIME type, size, modified date, Drive file ID
   - Summarize based on type:
     - **Google Docs/Sheets/Slides:** Export as plain text (first 10K chars), send to AI with prompt: "Write a 2-3 sentence summary of this document. Be specific about who it involves, what decisions or data it contains, and any key dates or amounts."
     - **PDFs:** Download, extract text with `pdftotext` (first 5 pages), same AI prompt
     - **DOCX:** Download, extract text with `python-docx`, same AI prompt
     - **Images (JPEG, PNG, HEIC, WebP):** Download, convert to JPEG if needed, send to vision model: "Describe what's shown in this image in exactly one sentence. Be specific about people, activities, and setting."
     - **Videos (MP4, MOV, AVI):** Extract frame at 1-second mark with `ffmpeg`, send to vision model with same image prompt
     - **Everything else:** Record metadata only, leave summary blank
4. **Write index files** to `~/clawd/memory/drive-indexes/<account-label>.md` — one file per Drive account, formatted as a Markdown table
5. **Save state** to `~/clawd/tasks/file-summarizer-state.json` — track completed file IDs so reruns only process new files
6. **Support batch mode** — process N files per run, then stop (for cron use)

**AI endpoint:** Use the OpenClaw gateway at `http://127.0.0.1:18789/v1/chat/completions`. Get the bearer token from `~/.openclaw/openclaw.json` (look for `gateway.token` or `gateway.secret`). Use model `gpt-4o-mini` or `openai/gpt-4o-mini`.

**Index file format** (one row per file):

```markdown
# Main Drive — File Index
*Last updated: 2026-03-01 | 4,312 files*

## Contracts/ (8 files)
| File | Size | Modified | Summary |
|------|------|----------|---------|
| lease-2024.pdf | 84 KB | Jan 12 | Apartment lease for 123 Main St, signed Jan 2024, expires Jan 2025. |
| consulting-acme.pdf | 52 KB | Mar 3 | Consulting agreement with Acme Corp, $5,000/mo, 6-month term starting April 2024. |

## Photos/Bali/ (234 files)
| File | Size | Modified | Summary |
|------|------|----------|---------|
| IMG_4821.jpg | 3.2 MB | Feb 14 | Rice terrace at sunset in Ubud, Bali, with palm trees in the foreground. |
```

---

### Phase 4 — Initialize and run first batch

```bash
# Initialize: scan Drive, build the queue (no AI calls yet)
python3 ~/clawd/scripts/file-summarizer.py --init

# Dry run to verify it's working
python3 ~/clawd/scripts/file-summarizer.py --batch-size 5 --dry-run

# First real batch
python3 ~/clawd/scripts/file-summarizer.py --batch-size 30

# Check progress
python3 ~/clawd/scripts/file-summarizer.py --status
```

---

### Phase 5 — Set up the cron job

Use the OpenClaw cron tool:

- **Schedule:** every 30 minutes
- **Task:** `python3 ~/clawd/scripts/file-summarizer.py --batch-size 20`
- Run until complete (the script reports done when all files have summaries)

After initial indexing is complete, switch to weekly maintenance:

- **Schedule:** every Sunday at 2am server time
- **Task:** `python3 ~/clawd/scripts/file-summarizer.py --init && python3 ~/clawd/scripts/file-summarizer.py --batch-size 500`

---

### Phase 6 — Wire into your agent

Once indexes exist in `memory/drive-indexes/`, create `DRIVE-MAP.md` in the workspace root:

```markdown
# DRIVE-MAP — Where Everything Lives

Start here when looking for any file. Do NOT do a blind search without checking here first.

## Accounts

### me@example.com — Main Drive
~5,000 files | 25 GB
Index: memory/drive-indexes/main.md

### personal@gmail.com — Personal
~3,000 files | 18 GB  
Index: memory/drive-indexes/personal.md

## How to find a file
1. Read DRIVE-MAP.md (this file)
2. Pick the right account index
3. Search the index for keywords in the Summary column
4. Return the exact filename + path to the user
```

Add to your `AGENTS.md` startup:

```
- File lookup: ALWAYS read DRIVE-MAP.md first → pick the right index → find the file
- Never ask Iso where something is without checking the indexes first
```

---

## Troubleshooting

**Token expired:** Rerun the OAuth script from Phase 2 for that account.

**Cron not running:** Use `openclaw cron list` to check job status.

**File won't summarize:** Check the `errors` key in `file-summarizer-state.json` — the script logs what failed and why.

**Only getting one result from a search:** See the QuickBooks skill for an example of how mcporter returns multiple content blocks — same principle applies if you're querying indexed data.

---

*Part of the [ai-first-business](https://github.com/isorabins/ai-first-business) project.*
*Follow the build: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
