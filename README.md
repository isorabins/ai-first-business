# AI-First Business

Real workflows, agent skills, and tools from building an AI-first small business in production.

Follow the build on YouTube: **[Life with AI with Iso](https://www.youtube.com/@isorabins)**

---

## Start here: Give your AI a memory for your files

The biggest unlock for working with AI is letting it know where everything is. These two files make that happen — pick the one that matches your setup:

---

### I use Claude Code (non-technical)

**Drop this into your Claude Code project:**

→ [`CLAUDE-CODE-local-file-indexer.md`](./CLAUDE-CODE-local-file-indexer.md)

Claude reads it and indexes your local machine. Then ask it "find that lease I signed in January" and it knows exactly where to look.

No setup. No code. Just drop the file and tell Claude to run it.

---

### I use OpenClaw (technical)

**Drop this into your OpenClaw workspace (`~/clawd/`):**

→ [`OPENCLAW-google-drive-indexer.md`](./OPENCLAW-google-drive-indexer.md)

Your agent reads it and indexes your Google Drive account(s) using the scripts in `/scripts/`. Runs as a background cron job. Writes searchable Markdown indexes your agent queries instantly.

Requires: Google OAuth setup, Python, ffmpeg. Your agent handles all of it — the MD file has full instructions.

The actual scripts are in [`/scripts/`](./scripts/):
- `file-summarizer.py` — does the indexing
- `auth-setup.py` — handles Google OAuth
- `DRIVE-MAP-template.md` — drop into your workspace root

---

## Everything else in this repo

```
/scripts/             # Working Python scripts (file summarizer, auth setup)
/skills/              # Reusable agent skill files
/workflows/           # Step-by-step workflow docs for specific tasks
/prompts/             # Prompt templates
```

Each folder has a README explaining what's inside.

---

## YouTube episodes

| Episode | Topic | Files |
|---------|-------|-------|
| Ep 03 | CMS blog publishing workflow | `/workflows/blog-cms/` |
| Coming | File indexing system | `CLAUDE-CODE-local-file-indexer.md`, `OPENCLAW-google-drive-indexer.md` |

---

MIT License — use freely, adapt, share.
