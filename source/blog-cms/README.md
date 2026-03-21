# Blog CMS — AI Agent Draft Pipeline

Full source code for a blog CMS where an AI agent submits drafts via API, a human reviews and publishes them through an admin dashboard, and published posts go live on a public blog.

**Episode:** Ep 03 — Building an AI-First Small Business: Week 1
**Stack:** Next.js (App Router) + Supabase + Tailwind CSS

---

## What This Does

```
AI Agent                    Admin Dashboard              Public Blog
   |                            |                            |
   |  POST /api/blog/draft      |                            |
   |  (Bearer token auth)       |                            |
   |--------------------------->|                            |
   |                            |  Review draft              |
   |                            |  /admin/review/[id]        |
   |                            |                            |
   |  Slack: "rejected"         |  Click Reject + note       |
   |<---------------------------|                            |
   |                            |                            |
   |  Revise and resubmit       |                            |
   |--------------------------->|                            |
   |                            |  Click Approve             |
   |  Slack: "published"        |-------------------------->|
   |<---------------------------|  Post goes live            |
   |                            |  /blog/[slug]              |
```

### Key features

- **Dual-source blog**: Merges MDX file-based posts with Supabase database posts. Supabase wins on slug conflicts.
- **Draft API with Zod validation**: Title, slug, content required. Tags auto-created. Category resolved by slug.
- **Admin dashboard**: Password-protected. List all posts, review rendered markdown, approve/reject with notes, edit, archive, delete.
- **Slack notifications**: Webhook fires on publish and reject so the agent knows immediately.
- **ISR (Incremental Static Regeneration)**: Blog pages revalidate on publish/archive. No full rebuild needed.
- **Security**: Middleware protects both `/admin/*` pages AND `/api/admin/*` API routes. RLS on Supabase limits public access to published posts only.

---

## File Map

```
source/blog-cms/
├── .env.example                          # Required environment variables
├── supabase/
│   └── blog-schema.sql                   # Full schema — run in Supabase SQL editor
├── src/
│   ├── middleware.ts                      # Auth middleware (admin pages + API routes)
│   ├── lib/
│   │   ├── blog.ts                       # Blog library — merges MDX + Supabase posts
│   │   └── supabase/
│   │       ├── types.ts                  # TypeScript types for blog tables
│   │       ├── admin.ts                  # Service-role client (bypasses RLS)
│   │       ├── client.ts                 # Browser client (anon key)
│   │       └── server.ts                 # Server client (SSR cookies)
│   └── app/
│       ├── blog/
│       │   ├── page.tsx                  # Public blog listing (featured + grid)
│       │   └── [slug]/page.tsx           # Public blog post (MDX rendering, SEO)
│       ├── api/
│       │   ├── blog/draft/route.ts       # Agent draft submission endpoint
│       │   └── admin/
│       │       ├── auth/route.ts         # Login/logout (cookie-based)
│       │       ├── blog/route.ts         # List all posts (admin)
│       │       └── blog/[id]/route.ts    # CRUD single post + Slack webhook
│       └── (admin)/admin/
│           ├── login/page.tsx            # Login page
│           ├── blog/
│           │   ├── page.tsx              # Post list with status badges
│           │   └── [id]/
│           │       └── AdminBlogEditor.tsx  # Full editor (save/publish/reject/archive/delete)
│           └── review/[id]/
│               ├── page.tsx              # Review page (rendered post preview)
│               └── ReviewBar.tsx         # Sticky action bar (approve/reject/edit)
```

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, then run `supabase/blog-schema.sql` in the SQL editor.

### 2. Set environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

You'll need:
- Supabase URL + anon key + service role key (from Settings > API)
- An admin password (anything you want)
- A draft API key (generate: `openssl rand -hex 32`)
- Optional: Slack webhook URL for agent notifications

### 3. Install dependencies

```bash
pnpm add @supabase/supabase-js @supabase/ssr zod gray-matter reading-time next-mdx-remote
```

### 4. Add the files to your Next.js project

Copy the `src/` directory into your project. The files use `@/` path aliases (standard Next.js).

### 5. Configure Next.js for remote images

If your posts use external images (e.g., from Supabase Storage), add the domain to `next.config.ts`:

```ts
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      // Add your domain here too
    ],
  },
}
```

---

## Using the Draft API

### Submit a draft

```bash
curl -X POST https://your-domain.com/api/blog/draft \
  -H "Authorization: Bearer ${DRAFT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Post",
    "slug": "my-first-post",
    "content": "## Hello\n\nThis is my first post written by an AI agent.",
    "excerpt": "A test post submitted via the API.",
    "category_slug": "tutorials",
    "tags": ["test", "ai"],
    "author_id": "ai"
  }'
```

**Response:**
```json
{ "ok": true, "post": { "id": "uuid", "slug": "my-first-post" } }
```

### Test bad auth (should return 401)

```bash
curl -X POST https://your-domain.com/api/blog/draft \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"title":"x","slug":"x","content":"x"}'
```

---

## Security Notes

### Middleware gotcha

The middleware MUST match both `/admin/:path*` AND `/api/admin/:path*`. If you only match page routes, your admin API endpoints are publicly accessible. This was a real bug we caught during testing — see the comment in `middleware.ts`.

### Admin auth

This uses a simple shared password with a cookie session. For production with multiple users, consider replacing with Supabase Auth or NextAuth.

### Draft API auth

The draft endpoint uses a Bearer token (`DRAFT_API_KEY`). This is simpler than full OAuth for a single agent, but make sure the key is stored securely and rotated periodically.

---

## Adapting This

**Different CMS backend?** The pattern works the same — replace Supabase calls with your database. The key files to modify are `src/lib/blog.ts` and the API routes.

**Different notification system?** Swap the Slack webhook in `api/admin/blog/[id]/route.ts` for Discord, email, or any HTTP endpoint.

**Different styling?** The admin UI uses plain Tailwind (gray palette). The public blog pages are also Tailwind — customize to match your brand.

**No MDX files?** Remove the `getMdxPosts()` / `getMdxPostBySlug()` functions from `blog.ts` and simplify `getAllPosts()` to only query Supabase.

---

## Lessons Learned

1. **Use `window.location.href` instead of `router.push()` after login.** Soft navigation doesn't re-send cookies, so middleware rejects the next request.

2. **Protect API routes in middleware, not just pages.** Easy to forget — `/admin/*` catches pages but not `/api/admin/*`.

3. **AI agents need explicit step-by-step instructions.** Without a skill file, the agent will skip steps, call wrong endpoints, or claim success without verifying. See `/skills/blog-cms-publisher/` for the skill we use.

4. **Event-driven notifications beat polling.** Instead of the agent checking for rejections on a timer, the admin fires a Slack webhook the moment you click Reject. Agent sees it instantly.

5. **Set `quality={95}` on hero images.** Next.js defaults to 75, which makes photos look blurry at large sizes.

---

*Built for [Noko](https://github.com/isorabins/ai-first-business) — the AI agent behind a small business. Follow the build on YouTube: [Life with AI with Iso](https://www.youtube.com/@isorabins)*
