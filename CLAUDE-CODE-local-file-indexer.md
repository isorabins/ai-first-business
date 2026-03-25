# Local File Indexer — Instructions for Claude Code

Drop this file into your Claude Code project. Claude will read it and know how to index your local machine.

---

## What this does

Builds a searchable Markdown index of files on your local machine so Claude can answer questions like "where is that contract I signed in January?" or "find me all my photos from the Bali trip" — without you having to remember where anything is.

---

## How to run it

Tell Claude:

> "Index my files. Follow the instructions in CLAUDE-CODE-local-file-indexer.md."

That's it. Claude will do the rest.

---

## Instructions for Claude

When the user asks you to index their files, follow this procedure exactly.

### Step 1 — Ask where to start

Ask the user: "Which folder do you want me to index? (e.g. ~/Documents, ~/Desktop, or your home folder ~)"

If they say their whole machine or home folder, start at `~` and skip hidden folders (anything starting with `.`) and system folders (`/System`, `/Library`, `/Applications`, `node_modules`, `.git`).

### Step 2 — Scan the directory tree

Walk the directory recursively. For each file, record:
- File name
- Full path
- File type (extension / MIME if detectable)
- Size
- Modified date

Skip: `.DS_Store`, `Thumbs.db`, anything in `node_modules`, `.git`, `__pycache__`, `.trash`, `/System`, `/Library`, `/Applications`.

### Step 3 — Summarize files

For each file you can read:

**Text files** (`.txt`, `.md`, `.pdf`, `.docx`, `.pages`, `.rtf`, spreadsheets, etc.):
Read the content (first 5 pages or ~10,000 characters). Write a 1-2 sentence summary describing what the document is, who's involved, and any key details (dates, amounts, decisions).

**Images** (`.jpg`, `.png`, `.heic`, `.gif`, `.webp`):
Use your vision capability to describe what's in the image in one sentence.

**Videos** (`.mp4`, `.mov`, `.avi`, `.mkv`):
Describe based on filename and folder context. Note: "Video file — [filename] in [folder]."

**Files you can't read** (executables, proprietary formats):
Just record the name, path, size, and date. Skip the summary.

### Step 4 — Write the index

Create a folder called `file-indexes/` in the current project directory.

Write one file per top-level folder you indexed, named after that folder (e.g. `file-indexes/Documents.md`).

Each index file should look like this:

```
# Documents — File Index
*Indexed: [date] | [N] files*

## Contracts/ (12 files)
| File | Size | Modified | Summary |
|------|------|----------|---------|
| lease-2024.pdf | 84 KB | Jan 12 | Apartment lease for 123 Main St, signed Jan 2024, expires Jan 2025. |
| consulting-agreement-acme.pdf | 52 KB | Mar 3 | Consulting agreement with Acme Corp, $5,000/mo, 6-month term. |

## Receipts/ (34 files)
...
```

Also write a top-level `file-indexes/INDEX.md` that lists every folder you indexed, with a one-line description and a link to its index file.

### Step 5 — Tell the user

When done, tell the user:
- How many files you indexed
- Where the index files are
- How to use them (just ask you a question about any file)

---

## Ongoing use

After the first index, the user can ask:
- "Find my lease agreement" → you check the index and tell them the exact path
- "What documents do I have from January?" → search the index by date
- "Re-index my Downloads folder" → repeat the process for that folder only

If files have changed or new files were added, the user can say "re-index [folder]" and you'll redo just that section.

---

## Tips

- Be patient. A large folder (10,000+ files) may take several minutes.
- If you hit a file you can't open, skip it and move on — don't stop.
- Prioritize documents, images, and videos. System files and code dependencies aren't useful to index.
- If the user has a specific folder they care about most (e.g. "my work folder"), start there.
