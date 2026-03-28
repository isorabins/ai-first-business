# File Indexer — Instructions for Claude Code

Drop this file into your Claude Code project. Claude will read it and know how to index your local files and Google Drive.

---

## What this does

Builds a searchable Markdown index of your files so Claude can answer "where is that contract from January?" or "find my Bali photos" without you having to remember where anything lives.

Works on:
- **Local files** — anything on your Mac or PC (Documents, Desktop, Downloads, etc.)
- **Google Drive** — your Drive files, with AI summaries of what's actually inside each one

---

## How to use it

Tell Claude:

> "Index my files. Follow the instructions in CLAUDE-CODE-local-file-indexer.md."

No scripts to run. Claude does the work.

---

## Path 1: Local Files (no setup needed)

Claude Code can read files directly on your machine. Tell it which folder to start with — it'll walk the tree, read each file, and write a searchable index.

**Tell Claude:** "Index my ~/Documents folder."

Claude will:
1. Walk the folder recursively
2. Read each text file (first ~10,000 characters) and write a 1-2 sentence summary
3. Describe images using vision
4. Write index files to `file-indexes/` in your project

**What to expect:**
- 500 files → a few minutes
- 5,000+ files → can take 30–60 min; Claude will process in batches across sessions
- Very large drives: Claude processes what it can per session. Say "continue indexing" to pick up where it left off.

**Limitations of local indexing:**
- Claude can only read what's on disk — it can't access Drive files unless they're synced locally
- Binary files (executables, proprietary formats) get recorded but not summarized
- Large folders may exceed what fits in one session — use batching (see below)

---

## Path 2: Google Drive via MCP (recommended for Drive users)

For indexing Google Drive directly, add a Google Drive MCP server to your project. This gives Claude Code live access to read, search, and summarize your Drive files.

### One-time setup (~10 minutes)

**Step 1: Create Google Cloud credentials**

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable these APIs: Google Drive API, Google Docs API, Google Sheets API
4. Go to APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID → Desktop app
5. Copy the Client ID and Client Secret

**Step 2: Authenticate**

Run this once in your terminal:

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y @a-bonus/google-docs-mcp auth
```

This opens a browser for Google sign-in. After you approve, a token is saved to `~/.config/google-docs-mcp/token.json`. You won't need to do this again.

**Step 3: Add MCP config to your project**

Create a file called `.mcp.json` in your Claude Code project directory:

```json
{
  "mcpServers": {
    "google-docs": {
      "command": "npx",
      "args": ["-y", "@a-bonus/google-docs-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

Restart Claude Code. You'll now have Google Drive tools available.

**Step 4: Tell Claude to index your Drive**

> "Index my Google Drive. Follow the instructions in CLAUDE-CODE-local-file-indexer.md."

---

## Instructions for Claude: How to Build the Index

When the user asks you to index their files, follow this procedure.

### For local files

**Step 1 — Ask which folder**

Ask: "Which folder do you want me to index? (e.g. ~/Documents, ~/Desktop, or your whole home folder)"

If they say their whole home folder, start at `~` and skip: `.` hidden folders, `/System`, `/Library`, `/Applications`, `node_modules`, `.git`, `__pycache__`, `.trash`.

**Step 2 — Scan and summarize**

Walk the directory recursively. For each file:

- **Text files** (`.txt`, `.md`, `.pdf`, `.docx`, `.pages`, `.csv`, spreadsheets): Read content (first ~10,000 chars). Write 1-2 sentence summary — what is it, who's involved, key dates/amounts/decisions.
- **Images** (`.jpg`, `.png`, `.heic`, `.gif`, `.webp`): Use vision. One sentence describing what's shown — be specific about people, activities, setting.
- **Videos** (`.mp4`, `.mov`, `.avi`): Record as `Video — [filename in context of folder]`
- **Everything else**: Record name, path, size, date. No summary.

**Step 3 — Write index files**

Write to `file-indexes/` in the project:
- One `.md` file per top-level folder (e.g. `file-indexes/Documents.md`)
- A master `file-indexes/INDEX.md` pointing to all of them

Format:

```markdown
# Documents — File Index
*Indexed: [date] | [N] files*

## Contracts/ (12 files)
| File | Path | Size | Modified | Summary |
|------|------|------|----------|---------|
| lease-2024.pdf | ~/Documents/Contracts/lease-2024.pdf | 84 KB | Jan 12 | Apartment lease at 123 Main St, signed Jan 2024, expires Jan 2025. |
```

**Step 4 — Handle large folders with batching**

If a folder has more than ~500 files, don't try to do everything in one session. Instead:
1. Process the first 500 files and write what you have
2. Tell the user: "Indexed 500 of 2,400 files in Documents. Say 'continue indexing' to process the next batch."
3. On each "continue indexing," pick up from where you left off (track progress in `file-indexes/.progress.json`)

### For Google Drive (when MCP is connected)

Use the `google-docs` MCP tools to:
1. List all folders in Drive
2. For each folder, list files
3. For each file: use `readDocument`, `readSpreadsheet`, or search tools to get content; write a 1-2 sentence summary
4. Write results to `file-indexes/drive-[account].md`

Use the same batching approach for large drives. Drive access is slower than local — expect 1-2 seconds per file for summarization.

---

## The Output

When complete, you'll have:

```
file-indexes/
  INDEX.md           ← start here — master map of everything
  Documents.md       ← all files in ~/Documents with summaries
  Desktop.md         ← all files on Desktop
  drive-main.md      ← Google Drive index (if connected)
  .progress.json     ← tracks what's been done (for batching)
```

Ask Claude anything:
> "Find the partnership agreement from 2024"
> "Where are my tax returns?"
> "What's in my Bali folder?"

Claude checks the index and tells you the exact path.

---

## Keeping it current

The index is a snapshot. To refresh:
- **Local:** Tell Claude "re-index ~/Documents" — it only processes files modified since the last run
- **Drive:** Tell Claude "update my Drive index" — same, only new/changed files

Reasonable rhythm: whenever you notice you can't find something, or once a month.

---

## Privacy note

Files are summarized by Claude using its built-in capability — text files are read directly, images use vision. For **local files**, nothing leaves your machine. For **Google Drive**, file content passes through the MCP server to Claude's context. Skip sensitive folders by telling Claude "skip ~/Documents/Medical."

---

*Part of the [ai-first-business](https://github.com/isorabins/ai-first-business) project.*
*Follow the build: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
