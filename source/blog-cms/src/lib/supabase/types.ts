// Blog types — matches the Supabase schema in supabase/blog-schema.sql

export type BlogPostStatus = 'draft' | 'published' | 'archived'

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description: string | null
  created_at: string
}

export interface BlogTag {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface BlogPostRow {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  featured_image: string | null
  author_id: string
  drafted_by: string
  status: BlogPostStatus
  rejection_note: string | null
  category_id: string | null
  meta_title: string | null
  meta_description: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  // joined
  blog_categories?: BlogCategory | null
  blog_post_tags?: Array<{ blog_tags: BlogTag }>
}
