# Google Drive File Indexer — Instructions for OpenClaw

Drop this file into your OpenClaw workspace (`~/clawd/` or wherever your agent reads from). Your agent will read it and know exactly how to index your Google Drive.

---

## What this does

Indexes every file across your Google Drive account(s) — documents, images, videos — using AI to summarize what each file contains. Writes searchable Markdown indexes your agent can query instantly. Once set up, you can ask your agent "find that invoice from March" or "what's in my Bali photos folder" and get a direct answer.

This runs as a background cron job on your OpenClaw server and processes files in batches without interrupting you.

---

## Instructions for your OpenClaw agent

When the user asks you to set up Drive indexing, follow this procedure.

---

### Phase 1 — Prerequisites

Check that these are available on the server:
```bash
which ffmpeg        # for video thumbnails
which pdftotext     # from poppler — for PDF text extraction
python3 --version
pip3 show google-api-python-client
```

If anything is missing:
```bash
# Ubuntu/Debian
apt install ffmpeg poppler-utils python3-pip
pip3 install google-auth google-auth-oauthlib google-api-python-client

# macOS
brew install ffmpeg poppler
pip3 install google-auth google-auth-oauthlib google-api-python-client
```

---

### Phase 2 — Google OAuth

The user needs to authorize their Google Drive account(s). Do this once per account.

**Ask the user:** "Do you have a Google Cloud project set up with Drive API enabled?"

If no, walk them through:
1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable Drive API: APIs & Services → Library → Google Drive API → Enable
4. Create credentials: APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID → Desktop app
5. Download the JSON — save as `client-credentials.json` in `~/clawd/scripts/`

Once they have credentials:
```bash
cd ~/clawd/scripts
python3 auth-setup.py --email their@gmail.com
```

This opens a browser, they log in, you get a token file saved to `~/clawd/scripts/tokens/`.

Repeat for each Drive account they want to index.

---

### Phase 3 — Configure the summarizer

The script lives at `~/clawd/scripts/file-summarizer.py`.

Edit the `ACCOUNTS` section at the top to match their accounts:
```python
ACCOUNTS = {
    "work": {
        "token": "work_at_example_com.json",   # file in tokens/ folder
        "email": "work@example.com",
        "label": "Work Drive",
    },
    "personal": {
        "token": "personal_at_gmail_com.json",
        "email": "personal@gmail.com",
        "label": "Personal",
    },
}
```

Set the AI endpoint — the OpenClaw gateway works best (no external API costs):
```python
AI_API_URL = "http://127.0.0.1:18789/v1/chat/completions"
AI_API_KEY = "their-gateway-token"   # from ~/.openclaw/openclaw.json
AI_MODEL   = "gpt-4o-mini"
```

Set the output directory:
```python
INDEX_DIR = Path("~/clawd/memory/drive-indexes")
STATE_FILE = Path("~/clawd/tasks/summarizer-state.json")
```

---

### Phase 4 — Initialize and start

```bash
# Scan Drive and build work queue (no AI calls yet, just lists files)
python3 ~/clawd/scripts/file-summarizer.py --init

# Preview the first batch without calling AI
python3 ~/clawd/scripts/file-summarizer.py --dry-run

# Run the first batch
python3 ~/clawd/scripts/file-summarizer.py --batch-size 30
```

Check progress:
```bash
python3 ~/clawd/scripts/file-summarizer.py --status
```

---

### Phase 5 — Set up the cron job

So it runs automatically in the background until complete (and re-indexes weekly after):

Use the OpenClaw cron tool to create a job:
- **Schedule:** every 30 minutes
- **Payload:** `python3 ~/clawd/scripts/file-summarizer.py --batch-size 30`
- **Session target:** isolated
- Run until the summarizer reports all accounts complete

After initial indexing is complete, change to weekly re-indexing:
- **Schedule:** every Sunday at 2am
- **Payload:** `python3 ~/clawd/scripts/file-summarizer.py --init && python3 ~/clawd/scripts/file-summarizer.py`

---

### Phase 6 — Wire it into your agent

Once the index files exist in `memory/drive-indexes/`, add a `DRIVE-MAP.md` to your workspace root. Here's the template:

```markdown
# DRIVE-MAP — Where Everything Lives

Start here when looking for any file.

## Accounts

### work@example.com — Work Drive
Index: memory/drive-indexes/work.md
Summaries: memory/drive-indexes/work-files.md

### personal@gmail.com — Personal
Index: memory/drive-indexes/personal.md
Summaries: memory/drive-indexes/personal-files.md

## How to find a file
1. Read DRIVE-MAP.md (this file)
2. Pick the right account index
3. Search the -files.md companion for keywords
4. Return the exact filename + path to the user
```

Add to your `AGENTS.md` startup instructions:
```
- File lookup: read DRIVE-MAP.md first → then the relevant index → find the file
- Never do a blind Drive search without checking the index first
```

---

## What gets indexed

| Type | How |
|------|-----|
| Google Docs | Exported as text, AI writes 2-3 sentence summary |
| Google Sheets | Exported as CSV, AI summarizes content |
| Google Slides | Exported as text, AI summarizes |
| PDFs | Text extracted (pdftotext), AI summarizes |
| DOCX | Text extracted (python-docx), AI summarizes |
| Images | Downloaded, converted to JPEG, AI vision describes |
| Videos | Thumbnail extracted at 1s mark, AI vision describes |

Skipped: files >500MB, executables, system files, `.DS_Store`, node_modules.

---

## Troubleshooting

**Token expired:** Re-run `python3 auth-setup.py --email account@gmail.com`

**Rate limited:** The script sets a 24h cooldown automatically. Check status and wait.

**File won't summarize:** Check `errors` in the state file at `tasks/summarizer-state.json`.

**Cron not running:** Use `openclaw cron list` to verify the job is scheduled.
