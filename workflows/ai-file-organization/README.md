# AI File Organization System

*How to build an AI that knows where all your files are — before you ask*

---

## The Problem

You have files everywhere. Multiple Google Drive accounts, maybe a Dropbox, maybe some repos. You've lost track of half of it. When you need something, you either search and hope, or you just know it's gone.

The real cost isn't the time you spend searching. It's that your AI assistant is just as lost as you are. You ask "find that partnership agreement" and it has to guess, or ask you, or give up.

This system fixes that.

---

## What It Does

Builds a searchable Markdown index of your files — with AI-generated summaries of what's actually *inside* each one. Once built, your AI can find any file in seconds. No searching. No guessing.

We ran this across 5 Google Drive accounts (~37,000 files, ~188 GB). The AI now knows what's in all of them.

---

## Pick Your Path

---

### Path A — Claude.ai (easiest, no setup)

**Drop [`CLAUDE-AI-file-indexer.md`](../../CLAUDE-AI-file-indexer.md) into a Claude.ai Project.**

Then tell Claude:

> "Index my files. Follow the instructions in CLAUDE-AI-file-indexer.md."

Claude.ai has a built-in Google Drive connector — just click **Add Content → Google Drive**, sign in once, and Claude can read your Docs directly. No MCP, no API keys, no terminal.

Upload files directly or share Drive documents one at a time. Claude builds the index and you save it to your Project so it persists.

**Best for:** Individual users, smaller file sets, people who want something working in 5 minutes.

**Limitations:**
- Drive connector currently supports Google Docs only (not Sheets, Slides, images)
- Files added one at a time (not bulk)
- Index lives in Project context, not a synced system

---

### Path B — OpenClaw (fully automated)

**Drop [`OPENCLAW-google-drive-indexer.md`](../../OPENCLAW-google-drive-indexer.md) into your OpenClaw workspace.**

Then tell your agent:

> "Set up Drive indexing. Follow the instructions in OPENCLAW-google-drive-indexer.md."

Your OpenClaw agent connects to your full Google Drive via API, indexes every file (Docs, Sheets, PDFs, images, videos), and runs a cron job to keep everything current. New files get picked up automatically. You never think about it again.

**Best for:** Power users, large drives (1,000+ files), teams who want always-current indexes, people running OpenClaw on a VPS.

**Limitations:**
- Requires OpenClaw on a VPS
- Initial setup takes ~30 min
- Large drives take hours to fully index (but run in background)

---

## What the Output Looks Like

Both paths produce the same thing — a `DRIVE-MAP.md` at the top level pointing to index files, and index files that look like this:

```markdown
# File Index
*Updated: 2026-03-01 | 4,312 files*

## Contracts/ (8 files)
| File | Modified | Summary |
|------|----------|---------|
| lease-2024.pdf | Jan 12 | Apartment lease at 123 Main St, signed Jan 2024, expires Jan 2025. |
| consulting-acme.pdf | Mar 3 | Consulting agreement with Acme Corp, $5,000/mo, 6-month term. |

## Photos/Bali/ (234 files)
| File | Modified | Summary |
|------|----------|---------|
| IMG_4821.jpg | Feb 14 | Rice terrace at sunset in Ubud, Bali, with palm trees in foreground. |
```

---

## What Gets Indexed

| File type | Claude.ai path | OpenClaw path |
|-----------|---------------|---------------|
| Google Docs | ✅ via Drive connector | ✅ |
| Google Sheets | ❌ (export as CSV first) | ✅ |
| Google Slides | ❌ (export as PDF first) | ✅ |
| PDFs (uploaded) | ✅ | ✅ |
| Images (uploaded) | ✅ via vision | ✅ via vision |
| Videos | ❌ | ✅ frame extraction |
| Word docs (uploaded) | ✅ | ✅ |

---

## Running Costs

**Claude.ai path:** Free with your Claude subscription. No extra costs.

**OpenClaw path:**

| Scale | Estimated cost |
|-------|---------------|
| 1,000 files | ~$0.50–2 |
| 5,000 files | ~$3–10 |
| 20,000+ files | ~$10–40 |

Use GPT-4o-mini for the summarizer. With OpenClaw's built-in Codex integration (ChatGPT Pro), you can run this at zero API cost — that's how we indexed 37,000 files for free.

---

*Part of the [ai-first-business](https://github.com/isorabins/ai-first-business) project.*
*Follow the build: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
