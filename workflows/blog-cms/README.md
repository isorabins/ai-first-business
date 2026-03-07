# Blog CMS Workflow

**Episode:** Ep 03 — Building an AI-First Small Business: Week 1
**Problem solved:** Getting an AI agent to reliably submit, handle rejections, and revise blog posts through a CMS.

---

## The problem

The agent knew *what* to do — but without explicit step-by-step instructions, it would skip steps, miss the rejection loop, or call the wrong endpoint. Giving it a dedicated workflow file fixed this completely.

---

## What this does

Defines the exact workflow for an AI agent to:
1. Submit a blog post draft to a CMS via API
2. Ping a Slack channel with the draft link
3. Check for rejected drafts and read the rejection notes
4. Revise the content based on the note
5. Resubmit and ping again

---

## Files

- `WORKFLOW.md` — the main file your agent reads before running this workflow
- `api-reference.md` — the API endpoints your agent calls

---

## Stack used

- **Agent:** Claude Sonnet (via OpenClaw)
- **CMS backend:** Custom Next.js admin + Supabase
- **Comms:** Slack
- **Trigger:** Agent heartbeat / on-demand via Slack message

You can adapt this to any CMS with a REST API (WordPress, Webflow, Ghost, etc.)
