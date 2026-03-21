import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('blog_posts')
      .select(`*, blog_categories(name, slug), blog_post_tags(blog_tags(name, slug))`)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, posts: data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
