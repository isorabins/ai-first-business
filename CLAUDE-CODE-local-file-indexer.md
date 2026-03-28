# Local File Indexer — Instructions for Claude Code

Drop this file into your Claude Code project. Claude will read it and know how to index your local machine.

---

## What this does

Builds a searchable Markdown index of files on your local machine so Claude can answer questions like "where is that contract I signed in January?" or "find me all my photos from the Bali trip" — without you having to remember where anything is.

---

## How to use it

Tell Claude:

> "Index my files. Follow the instructions in CLAUDE-CODE-local-file-indexer.md."

That's it. Claude will do the rest — no scripts to run, nothing to install.

---

## Instructions for Claude Code

When the user asks you to index their files, follow this procedure exactly.

### Step 1 — Ask where to start

Ask the user: "Which folder do you want me to index? (e.g. ~/Documents, ~/Desktop, or your whole home folder)"

If they say their whole machine or home folder, start at `~` and skip hidden folders (anything starting with `.`) and system folders (`/System`, `/Library`, `/Applications`, `node_modules`, `.git`).

### Step 2 — Scan the directory tree

Walk the directory recursively. For each file, record:
- File name
- Full path
- File type (extension)
- Size
- Modified date

Skip: `.DS_Store`, `Thumbs.db`, `node_modules`, `.git`, `__pycache__`, `.trash`, `/System`, `/Library`, `/Applications`.

### Step 3 — Summarize files

For each file you can read:

**Text files** (`.txt`, `.md`, `.pdf`, `.docx`, `.pages`, `.rtf`, spreadsheets, CSVs):
Read the content (first ~10,000 characters). Write a 1-2 sentence summary describing what the document is, who's involved, and any key details (dates, amounts, decisions).

**Images** (`.jpg`, `.jpeg`, `.png`, `.heic`, `.gif`, `.webp`):
Use your vision capability. Describe what's in the image in one sentence. Be specific about people, activities, and setting.

**Videos** (`.mp4`, `.mov`, `.avi`, `.mkv`):
Note based on filename and folder context: `Video file — [filename]`

**Files you can't read** (executables, binary formats):
Just record the name, path, size, and date. No summary needed.

### Step 4 — Write the index files

Create a folder called `file-indexes/` in the current project directory.

Write one index file per top-level folder you scanned. Name each file after the folder (e.g. `file-indexes/Documents.md`, `file-indexes/Desktop.md`).

Format:

```markdown
# Documents — File Index
*Indexed: [date] | [N] files*

## Contracts/ (12 files)
| File | Path | Size | Modified | Summary |
|------|------|------|----------|---------|
| lease-2024.pdf | ~/Documents/Contracts/lease-2024.pdf | 84 KB | Jan 12 | Apartment lease for 123 Main St, signed Jan 2024, expires Jan 2025. |
| consulting-agreement.pdf | ~/Documents/Contracts/consulting-agreement.pdf | 52 KB | Mar 3 | Consulting agreement with Acme Corp, $5,000/mo, 6-month term. |

## Receipts/ (34 files)
| File | Path | Size | Modified | Summary |
|------|------|------|----------|---------|
...
```

Also write a top-level `file-indexes/INDEX.md` — the master map:

```markdown
# File Index — Master Map
*Indexed: [date]*

## Folders

| Folder | Files | Description |
|--------|-------|-------------|
| Documents | 847 | Contracts, invoices, notes, PDFs |
| Desktop | 34 | Recent downloads, current projects |
| Downloads | 1,204 | Mixed — installers, documents, media |

## How to use this
Ask me any question about your files. I'll check the index and tell you exactly where things are.
Examples:
- "Find the lease agreement"
- "Where are my tax returns?"
- "Do I have any photos from the Bali trip?"
```

### Step 5 — Tell the user what you did

When done, report:
- How many files you indexed
- Where the index files are (`file-indexes/`)
- A quick example: "You can now ask me 'find the partnership agreement from 2024' and I'll find it immediately."

---

## Ongoing use

After the first index, the user can ask:
- "Find my lease agreement" → check the index, return the exact path
- "What documents do I have from January?" → search the index by date
- "Re-index my Downloads folder" → redo just that section

The index is a snapshot. To update it after adding new files, the user can say "re-index [folder]" — only new/changed files get processed.

---

## Tips for Claude

- Large folders (10,000+ files) take time. Tell the user what you're doing as you go.
- If you hit a file you can't open, skip it — don't stop.
- Prioritize Documents, Desktop, and work folders. System files and code dependencies (`node_modules`, `.git`) aren't useful to index.
- If vision is slow or not available, skip images and note them as `(image: filename)` — still useful to know they exist.
- After indexing, stay oriented: when the user asks about a file, always check the index before saying you don't know.

---

*Part of the [ai-first-business](https://github.com/isorabins/ai-first-business) project.*
*Follow the build: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
