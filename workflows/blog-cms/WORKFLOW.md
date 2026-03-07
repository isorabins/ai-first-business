# Noko's Blog CMS Workflow

This file defines the exact steps for submitting, reviewing, and revising blog post drafts through the Forage Bali CMS. Read this before running any blog-related task.

---

## Who runs this

This workflow is for an AI agent (Noko) operating as the content pipeline for a small business. The human (Iso or Yuka) writes the content; the agent handles the technical submission and revision loop.

---

## Step 1 — Submit a draft

Call `POST /api/blog/draft` with the following fields:

```json
{
  "title": "Post title",
  "slug": "post-slug-lowercase-dashes",
  "excerpt": "One or two sentences that appear in the blog listing.",
  "content": "Full post content in markdown.",
  "category_slug": "stories",
  "tags": ["tag1", "tag2"]
}
```

**Required:** `title`, `slug`, `content`
**Optional:** `excerpt`, `category_slug`, `tags`

**Authentication:** Bearer token in the `Authorization` header.

**What happens server-side:**
- Post is inserted with `status='draft'` and `drafted_by='noko'`
- Tags are upserted and linked
- Response: `{ ok: true, post: { id: "...", slug: "..." } }`

**After submitting — ping Slack:**
> "New draft ready for review: '[title]' → [your-domain]/admin/blog"

---

## Step 2 — Check for rejections

Query your database for drafts that have a `rejection_note`:

```
GET /blog_posts?status=eq.draft&rejection_note=not.is.null
```

Returns an array of posts with rejection notes attached.

---

## Step 3 — Revise

For each rejected post:
1. Read the `rejection_note` carefully
2. Revise the `content` to address the specific feedback
3. Do not change the `title` or `slug` unless the note asks for it
4. Resubmit via `PATCH /blog_posts?id=eq.[POST_ID]`:

```json
{
  "content": "Revised content here...",
  "rejection_note": null
}
```

Setting `rejection_note: null` clears the flag so it won't appear in the next rejection check.

**After resubmitting — ping Slack:**
> "Revised '[title]' based on your note — ready for another look. [your-domain]/admin/blog"

---

## Step 4 — Human reviews and publishes

The human visits the admin panel, previews the post, and either:
- Clicks **Publish** → post goes live
- Clicks **Reject** + writes a note → loop repeats from Step 2

---

## Rules

- Always ping Slack after submitting or revising — the human needs to know there's something to review
- Never publish directly — always submit as draft, let the human publish
- If the API returns an error, log it and ping Slack with the error details
- Clear `rejection_note` when resubmitting — leaving it set will cause the post to appear as rejected again on the next check
- One revision per heartbeat cycle — don't loop more than once per run

---

## Adapting this to your stack

This workflow was built for a Next.js + Supabase CMS, but the pattern works for any CMS with a REST API:

| This workflow | Your stack equivalent |
|---|---|
| `POST /api/blog/draft` | WordPress REST API: `POST /wp/v2/posts` |
| `PATCH /blog_posts?id=eq.[id]` | Ghost Admin API: `PUT /ghost/api/admin/posts/[id]/` |
| `status='draft'` | Any CMS draft/unpublished state |
| `rejection_note` field | Add a custom field or use post meta |

The core pattern — submit → notify → check for feedback → revise → resubmit — works the same way regardless of stack.
