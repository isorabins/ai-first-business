# Skill: Blog CMS Publisher

**What this does:** Gives your AI agent a reliable workflow for submitting blog post drafts to a CMS, handling rejections, and revising until the human approves.

**The problem it solves:** Without explicit step-by-step instructions, agents skip steps — they'll write the post but forget to notify you, or revise without clearing the rejection flag, or lose track of which posts need attention. This skill fixes that.

**Stack:** Works with any CMS that has a REST API. Examples for WordPress, Ghost, and Webflow included at the bottom.

---

## Setup

### 1. Add this to your agent's TOOLS.md (or equivalent)

```markdown
## Blog CMS Publisher
When asked to submit, check, or revise blog posts: read `skills/blog-cms-publisher/SKILL.md` first and follow it exactly.
```

### 2. Set your environment variables

```bash
CMS_API_URL=https://your-site.com/api
CMS_API_KEY=your_api_key_here
SLACK_CHANNEL=#your-channel   # wherever you want draft notifications
```

### 3. Make sure your CMS has these fields on blog posts

| Field | Type | Purpose |
|-------|------|---------|
| `title` | string | Post title |
| `slug` | string | URL slug |
| `content` | markdown/html | Body content |
| `excerpt` | string | Short summary for listing pages |
| `status` | enum: `draft`, `published` | Publication state |
| `rejection_note` | string / null | Human's feedback when rejecting |
| `drafted_by` | string | Set to `"ai"` so you can filter AI drafts |

---

## The Workflow

### Step 1 — Submit a draft

Call your CMS draft endpoint with:

```json
{
  "title": "Post title here",
  "slug": "post-slug-lowercase-with-dashes",
  "excerpt": "One or two sentences. Appears in blog listings.",
  "content": "Full post content in markdown.",
  "category": "your-category",
  "tags": ["tag1", "tag2"],
  "drafted_by": "ai"
}
```

After a successful submission, **immediately notify the human** via Slack (or whatever comms you use):

> "New draft ready for review: '[title]' → [your-cms-url]/admin/blog"

**Never skip this notification.** The human can't review what they don't know exists.

---

### Step 2 — Check for rejections

Query your CMS for drafts that have a `rejection_note`:

```
GET /api/blog/posts?status=draft&has_rejection_note=true
```

Returns posts the human has reviewed and sent back with feedback.

---

### Step 3 — Revise

For each rejected post:

1. Read the `rejection_note` carefully — understand exactly what the human wants changed
2. Revise the `content` to address the feedback specifically
3. Do not change `title` or `slug` unless the note explicitly asks for it
4. Submit the revision:

```json
{
  "content": "Revised content here...",
  "rejection_note": null
}
```

**Critical:** Set `rejection_note` to `null` when resubmitting. If you leave it set, the post will appear rejected again on the next check even after you've revised it.

After resubmitting, **notify the human again:**

> "Revised '[title]' based on your note — ready for another look. [your-cms-url]/admin/blog"

---

### Step 4 — Human publishes

The human reviews the draft in the admin panel and either:
- Clicks **Publish** → post goes live, workflow complete
- Clicks **Reject** + writes a note → loop repeats from Step 2

---

## Rules

- Always notify via Slack after every submission or revision
- Never publish directly — always draft, let the human decide when to publish
- One revision per check cycle — don't loop more than once per run
- If the API returns an error, log it and notify the human with the error details
- Clear `rejection_note` on resubmission — always

---

## Adapting to your stack

### Next.js + Supabase (what this was built on)

```bash
# Submit draft
curl -X POST https://your-site.com/api/blog/draft \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "slug": "...", "content": "...", "drafted_by": "ai"}'

# Check for rejections (Supabase REST)
curl "${SUPABASE_URL}/rest/v1/blog_posts?status=eq.draft&rejection_note=not.is.null" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

# Revise (clear rejection note)
curl -X PATCH "${SUPABASE_URL}/rest/v1/blog_posts?id=eq.POST_ID" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"content": "Revised...", "rejection_note": null}'
```

### WordPress REST API

```bash
# Submit draft
curl -X POST https://your-site.com/wp-json/wp/v2/posts \
  -H "Authorization: Bearer ${WP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title": "...", "content": "...", "status": "draft"}'

# Check for rejections — use a custom meta field 'rejection_note'
curl "https://your-site.com/wp-json/wp/v2/posts?status=draft&meta_key=rejection_note&meta_value=" \
  -H "Authorization: Bearer ${WP_TOKEN}"

# Revise
curl -X POST https://your-site.com/wp-json/wp/v2/posts/POST_ID \
  -H "Authorization: Bearer ${WP_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"content": "Revised...", "meta": {"rejection_note": ""}}'
```

### Ghost Admin API

```bash
# Submit draft
curl -X POST https://your-site.com/ghost/api/admin/posts/ \
  -H "Authorization: Ghost ${GHOST_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"posts": [{"title": "...", "lexical": "...", "status": "draft"}]}'

# Revise
curl -X PUT https://your-site.com/ghost/api/admin/posts/POST_ID/ \
  -H "Authorization: Ghost ${GHOST_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"posts": [{"lexical": "Revised...", "updated_at": "CURRENT_TIMESTAMP"}]}'
```

---

## Adding an automatic trigger (heartbeat)

To have your agent check for rejections and draft new posts automatically, add this to your agent's heartbeat/cron config:

```markdown
## Blog tasks (nightly)

1. Check for rejected drafts:
   - Query CMS for posts where status='draft' AND rejection_note is not null
   - For each: read the note, revise, resubmit, notify via Slack

2. Draft new content (if applicable):
   - [Define your trigger — e.g. after a session, once a week, etc.]
   - Submit via draft endpoint
   - Notify via Slack with link to review
```

---

*Built for [Noko](https://github.com/isorabins/ai-first-business) — the AI agent behind Forage Bali. Follow the build on YouTube: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
