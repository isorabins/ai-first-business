import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/admin'

// Optional: notify your agent via Slack webhook when posts are published/rejected
async function notifyAgent(event: 'published' | 'rejected', title: string, rejectionNote?: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const text =
    event === 'published'
      ? `"${title}" was published.`
      : `"${title}" was rejected.\nNote: ${rejectionNote}\nPlease revise and resubmit.`

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  } catch (err) {
    console.error('[notifyAgent] Slack webhook error:', err)
  }
}

interface Props {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: Props) {
  try {
    const { id } = await params
    const db = createAdminClient()
    const { data, error } = await db
      .from('blog_posts')
      .select(`*, blog_categories(*), blog_post_tags(blog_tags(*))`)
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, post: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const db = createAdminClient()

    // Build update payload
    const update: Record<string, unknown> = {}
    const allowed = [
      'title', 'slug', 'content', 'excerpt', 'featured_image',
      'status', 'rejection_note', 'category_id', 'meta_title', 'meta_description',
    ]
    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    // Handle publish
    if (body.status === 'published') {
      update.published_at = new Date().toISOString()
      update.rejection_note = null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
    }

    const { data, error } = await db
      .from('blog_posts')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Update failed.' }, { status: 500 })
    }

    // Revalidate public blog pages on publish/archive
    if (body.status === 'published' || body.status === 'archived') {
      revalidatePath('/blog')
      revalidatePath(`/blog/${data.slug}`)
    }
    revalidatePath('/admin/blog')

    // Notify agent via Slack on publish or reject
    if (body.status === 'published') {
      notifyAgent('published', data.title)
    } else if (body.rejection_note) {
      notifyAgent('rejected', data.title, body.rejection_note)
    }

    return NextResponse.json({ ok: true, post: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Props) {
  try {
    const { id } = await params
    const db = createAdminClient()

    const { data: existing } = await db
      .from('blog_posts')
      .select('slug')
      .eq('id', id)
      .single()

    const { error } = await db.from('blog_posts').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (existing?.slug) {
      revalidatePath('/blog')
      revalidatePath(`/blog/${existing.slug}`)
    }
    revalidatePath('/admin/blog')

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
