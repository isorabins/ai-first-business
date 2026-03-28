# File Indexer — Instructions for Claude

Drop this file into your Claude project. Claude will read it and know how to index your files.

---

## What this does

Builds a searchable Markdown index of your files so Claude can instantly answer "where is that contract from January?" or "what's in my project folder?" — without you having to remember where anything lives.

---

## Which Claude are you using?

**→ [Claude.ai](#path-a-claudeai-the-web--desktop-app)** — the web or desktop app at claude.ai

**→ [Claude Code](#path-b-claude-code-the-cli-tool)** — the terminal CLI (`claude` command in your terminal)

---

## Path A: Claude.ai (the web / desktop app)

### Connect Google Drive (one time, 30 seconds)

Claude.ai has a built-in Drive connector — no API keys, no terminal, nothing to install.

1. Open a Project in Claude.ai
2. Click **Add Content** → **Google Drive**
3. Sign in with your Google account
4. Done — Claude can now read your Drive files

> Available on Pro, Max, Team, and Enterprise plans.

### Index your files

Tell Claude:

> "Index my files. Follow the instructions in CLAUDE-AI-file-indexer.md."

Then share files either by:
- **Uploading directly** — click the paperclip, attach PDFs, Word docs, images
- **Adding from Drive** — click + → Add from Google Drive, pick files

Claude reads each one, writes summaries, and builds a searchable index. Save the index to your Project knowledge so it persists across conversations.

### What the Drive connector supports

| Type | Supported |
|------|-----------|
| Google Docs | ✅ full text |
| Google Sheets | ❌ — export as CSV and upload directly |
| Google Slides | ❌ — export as PDF and upload directly |
| PDFs (uploaded) | ✅ |
| Images (uploaded) | ✅ via vision |
| Word docs (uploaded) | ✅ |

### Limitation: files are added one at a time

The Claude.ai connector adds files individually. For bulk indexing across hundreds of files, use the OpenClaw path (see `OPENCLAW-google-drive-indexer.md`).

---

## Path B: Claude Code (the CLI tool)

### Connect Google Drive via MCP (one time, ~10 minutes)

Claude Code uses MCP servers to connect to external services. Add the Google Drive MCP once and it's always available.

**Step 1: Get Google Cloud credentials**

1. Go to https://console.cloud.google.com
2. Create or select a project
3. Enable: Google Drive API, Google Docs API, Google Sheets API
4. Go to APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID → **Desktop app**
5. Copy the Client ID and Client Secret

**Step 2: Authenticate**

Run once in your terminal:

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y @a-bonus/google-docs-mcp auth
```

A browser window opens. Sign in with Google, approve access. Token saved automatically — you won't need to do this again.

**Step 3: Add MCP config**

Create `.mcp.json` in your project directory:

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

Restart Claude Code. Google Drive tools are now available.

**Step 4: Index your files**

Tell Claude:

> "Index my files. Follow the instructions in CLAUDE-AI-file-indexer.md."

Claude Code can index both local files and Google Drive. Tell it which to start with:
- "Index my ~/Documents folder"
- "Index my Google Drive"
- "Index both my local Documents and my Drive"

### What Claude Code can index

| Type | Supported |
|------|-----------|
| Local files (any folder) | ✅ reads directly |
| Google Docs | ✅ via MCP |
| Google Sheets | ✅ via MCP |
| Google Slides | ✅ via MCP |
| PDFs (local or Drive) | ✅ |
| Images (local) | ✅ via vision |
| Word docs | ✅ |

### Batching for large folders

For folders with 500+ files, Claude Code processes in batches across sessions. It'll tell you when to say "continue indexing" to pick up where it left off.

---

## Instructions for Claude: How to Build the Index

*(Follow this regardless of which path was used to connect Drive)*

### Step 1 — Find out what to index

Ask:
> "What would you like me to index? Local files, Google Drive, or both?"

### Step 2 — Process each file

**Google Docs / Word / PDFs / text files:**
Read content. Write a 2-sentence summary: what is it, who's involved, key dates/amounts/decisions.

**Images:**
Use vision. One sentence — specific about people, activities, setting.

**Spreadsheets / CSVs:**
Summarize what data is tracked — column types, date range, type of records.

**Files you can't read:**
Record filename, note it wasn't summarized.

### Step 3 — Write the index

Format:

```markdown
# File Index
*Created: [date] | [N] files*

## Contracts/ (8 files)
| File | Modified | Summary |
|------|----------|---------|
| lease-2024.pdf | Jan 12 | Apartment lease at 123 Main St, signed Jan 2024, expires Jan 2025. |
| consulting-acme.pdf | Mar 3 | Consulting agreement with Acme Corp, $5,000/mo, 6-month term starting April 2024. |

## Photos/ (34 files)
| File | Modified | Summary |
|------|----------|---------|
| bali-trip.jpg | Feb 14 | Rice terraces at sunset in Ubud with palm trees in foreground. |
```

### Step 4 — Save it

- **Claude.ai:** Offer to add the index to Project knowledge so it persists
- **Claude Code:** Write to `file-indexes/INDEX.md` in the project directory

---

## After indexing

Ask anything:
- "Find the partnership agreement from 2024"
- "Where are my tax returns?"
- "What's in my Bali folder?"

To update: say "add [new file] to my index" or "re-index my Downloads folder."

---

*Part of the [ai-first-business](https://github.com/isorabins/ai-first-business) project.*
*Follow the build: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
