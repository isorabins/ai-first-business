import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const draftSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(300),
  slug: z.string().trim().min(1, 'slug is required').max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase with hyphens only'),
  content: z.string().trim().min(1, 'content is required').max(100_000),
  excerpt: z.string().trim().max(500).optional(),
  category_slug: z.string().trim().optional(),
  featured_image: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  author_id: z.string().trim().max(50).optional(),
})

export async function POST(request: Request) {
  try {
    // Auth: Bearer token — set DRAFT_API_KEY in your .env.local
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const expectedToken = process.env.DRAFT_API_KEY
    if (!token || token !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const parsed = draftSchema.safeParse(body)

    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
      return NextResponse.json({ error: 'Validation failed', issues }, { status: 400 })
    }

    const { title, slug, content, excerpt, category_slug, featured_image, tags, author_id } = parsed.data
    const db = createAdminClient()

    // Resolve category_id from slug if provided
    let category_id: string | null = null
    if (category_slug) {
      const { data: cat } = await db
        .from('blog_categories')
        .select('id')
        .eq('slug', category_slug)
        .single()
      category_id = cat?.id ?? null
    }

    const { data: post, error } = await db
      .from('blog_posts')
      .insert({
        title,
        slug,
        content,
        excerpt: excerpt || null,
        featured_image: featured_image || null,
        category_id,
        author_id: author_id || 'ai',
        drafted_by: 'ai',
        status: 'draft',
      })
      .select('id, slug')
      .single()

    if (error) {
      console.error('blog_draft_insert_failed', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Insert tags if provided
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        const tagSlug = tagName.toLowerCase().replace(/\s+/g, '-')

        const { data: tag } = await db
          .from('blog_tags')
          .upsert({ name: tagName, slug: tagSlug }, { onConflict: 'slug' })
          .select('id')
          .single()

        if (tag?.id) {
          await db
            .from('blog_post_tags')
            .insert({ post_id: post.id, tag_id: tag.id })
            .throwOnError()
        }
      }
    }

    return NextResponse.json({ ok: true, post: { id: post.id, slug: post.slug } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
