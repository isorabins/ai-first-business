# File Indexer — Instructions for Claude.ai

Drop this file into a Claude.ai Project. Claude will read it and know how to index your files.

---

## What this does

Builds a searchable Markdown index of your files so Claude can instantly answer "where is that contract from January?" or "what's in my project folder?" — without you having to remember where anything lives.

Works with:
- **Files you upload directly** — PDFs, docs, images, anything you attach
- **Google Drive** — connect your Drive account and Claude can read your Google Docs directly

---

## Setup (one time)

### Connect Google Drive

1. In Claude.ai, open a Project (or start a new one)
2. Click **Add Content** → **Google Drive**
3. Sign in with your Google account — one click, no technical setup

That's it. Claude can now read any Google Doc you share with it.

> **Note:** This works on Pro, Max, Team, and Enterprise plans.

---

## How to use it

Once your Drive is connected, tell Claude:

> "Index my files. Follow the instructions in CLAUDE-AI-file-indexer.md."

Then either:
- **Upload files directly** to the conversation (PDFs, docs, images)
- **Share Drive documents** by clicking + → Add from Google Drive and selecting files

Claude will read each file, write a summary, and build a searchable index you can query instantly.

---

## Instructions for Claude

When the user asks you to index their files, follow this procedure.

### Step 1 — Find out what they have

Ask:
> "What would you like me to index? You can:
> 1. Upload files directly here (PDF, Word, images, etc.)
> 2. Add Google Docs from your connected Drive
> 3. Both"

### Step 2 — Process each file

For each file or document the user provides:

**Google Docs / uploaded text documents** (Word, PDF, plain text):
Read the content. Write a 2-sentence summary covering: what it is, who's involved, and any key details (dates, amounts, decisions made).

**Images** (.jpg, .png, .gif, etc.):
Use vision. Describe what's in the image in one sentence — be specific about people, activities, and setting.

**Spreadsheets / CSVs** (if uploaded directly):
Summarize what the data is tracking — column types, date range, what kind of records.

**Files you can't read** (executables, unsupported formats):
Record the filename and note it couldn't be summarized.

### Step 3 — Build the index

After processing all files, write a master index document. Create it as a Markdown file the user can save (or offer to add it to their Project knowledge).

Format:

```markdown
# File Index
*Created: [date] | [N] files*

## Contracts/
| File | Summary |
|------|---------|
| lease-2024.pdf | Apartment lease at 123 Main St, signed Jan 2024, expires Jan 2025. |
| consulting-acme.pdf | Consulting agreement with Acme Corp, $5,000/mo, 6-month term starting April 2024. |

## Photos/
| File | Summary |
|------|---------|
| bali-trip-cover.jpg | Aerial view of Ubud rice terraces at sunset with palm trees in foreground. |

## Reports/
| File | Summary |
|------|---------|
| q1-2025-revenue.csv | Quarterly revenue tracking Jan–Mar 2025, 847 transactions across 3 product lines. |
```

### Step 4 — Save the index

Offer to:
1. Write the index as a Project file (so it persists across conversations)
2. Copy it to their clipboard to save elsewhere

Tell the user: "Save this index file to your Project knowledge so I can reference it in future conversations — just click 'Add to Project' when you paste it."

---

## Ongoing use

Once the index exists in the Project, the user can ask:
- "Find the partnership agreement from 2024" → check the index, give the exact filename
- "Which reports do I have from Q1?" → search by date/keyword in the index
- "Summarize everything in the Contracts folder" → read each listed file

To add new files: share them in the conversation and say "add these to my index." Claude updates the index document.

---

## What to know about the Drive connector

Claude.ai's built-in Drive connector currently supports:

| Type | Supported |
|------|-----------|
| Google Docs | ✅ Full text |
| Google Sheets | ❌ Not yet |
| Google Slides | ❌ Not yet |
| Images inside Docs | ❌ Not extracted |
| PDFs (uploaded directly) | ✅ |
| Word docs (uploaded directly) | ✅ |
| Images (uploaded directly) | ✅ via vision |

**For Sheets and Slides:** Export as PDF or CSV and upload directly — Claude can read those.

**For large drives:** The Drive connector lets you add files one at a time to a conversation. For bulk indexing across hundreds of files, use the OpenClaw path (see `OPENCLAW-google-drive-indexer.md`) which processes your entire Drive automatically.

---

## Tips

- Add the index file to your **Project knowledge** so it persists across all conversations in that project
- When the index gets long (100+ files), Claude will search it rather than read every row — that's fine
- Re-run the indexing process periodically for new files, or just say "add [new file] to my index" as you go

---

*Part of the [ai-first-business](https://github.com/isorabins/ai-first-business) project.*
*Follow the build: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
