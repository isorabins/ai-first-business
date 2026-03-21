import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import readingTime from 'reading-time'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BlogPostRow } from '@/lib/supabase/types'

const postsDirectory = path.join(process.cwd(), 'src/content/blog')

export interface BlogPost {
  slug: string
  title: string
  description: string
  date: string
  author: string
  image?: string
  tags?: string[]
  readingTime: string
  content: string
  source: 'mdx' | 'supabase'
  faqs?: Array<{ question: string; answer: string }>
}

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  date: string
  author: string
  image?: string
  tags?: string[]
  readingTime: string
  source: 'mdx' | 'supabase'
}

// --- MDX (file-system) helpers -----------------------------------------------

export function getMdxPosts(): BlogPostMeta[] {
  if (!fs.existsSync(postsDirectory)) return []

  return fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx?$/, '')
      const fullPath = path.join(postsDirectory, fileName)
      const { data, content } = matter(fs.readFileSync(fullPath, 'utf8'))
      const stats = readingTime(content)

      return {
        slug,
        title: data.title,
        description: data.description,
        date: data.date,
        author: data.author || 'Your Site',
        image: data.image,
        tags: data.tags,
        readingTime: stats.text,
        draft: data.draft || false,
        source: 'mdx' as const,
      }
    })
    .filter((post) => !post.draft)
    .sort((a, b) => (new Date(b.date) > new Date(a.date) ? 1 : -1))
}

export function getMdxPostBySlug(slug: string): BlogPost | null {
  try {
    let filePath = path.join(postsDirectory, `${slug}.mdx`)
    if (!fs.existsSync(filePath)) {
      filePath = path.join(postsDirectory, `${slug}.md`)
    }
    if (!fs.existsSync(filePath)) return null

    const { data, content } = matter(fs.readFileSync(filePath, 'utf8'))
    const stats = readingTime(content)

    return {
      slug,
      title: data.title,
      description: data.description,
      date: data.date,
      author: data.author || 'Your Site',
      image: data.image,
      tags: data.tags,
      readingTime: stats.text,
      content,
      source: 'mdx',
      faqs: data.faqs,
    }
  } catch {
    return null
  }
}

// --- Supabase helpers --------------------------------------------------------

// Map internal author IDs to display names — customize for your team
const AUTHOR_DISPLAY_NAMES: Record<string, string> = {
  ai: 'AI Assistant',
  // Add your team: 'jane': 'Jane', 'bob': 'Bob', etc.
}

function rowToMeta(row: BlogPostRow): BlogPostMeta {
  const stats = readingTime(row.content)
  return {
    slug: row.slug,
    title: row.title,
    description: row.excerpt ?? '',
    date: (row.published_at ?? row.created_at).split('T')[0],
    author: AUTHOR_DISPLAY_NAMES[row.author_id] ?? row.author_id,
    image: row.featured_image ?? undefined,
    tags: row.blog_post_tags?.map((pt) => pt.blog_tags.name),
    readingTime: stats.text,
    source: 'supabase',
  }
}

function rowToPost(row: BlogPostRow): BlogPost {
  const meta = rowToMeta(row)
  return { ...meta, content: row.content }
}

export async function getSupabasePosts(): Promise<BlogPostMeta[]> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('blog_posts')
      .select(
        `*, blog_categories(*), blog_post_tags(blog_tags(*))`,
      )
      .eq('status', 'published')
      .order('published_at', { ascending: false })

    if (error || !data) return []
    return (data as BlogPostRow[]).map(rowToMeta)
  } catch {
    return []
  }
}

export async function getSupabasePostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const db = createAdminClient()
    const { data, error } = await db
      .from('blog_posts')
      .select(`*, blog_categories(*), blog_post_tags(blog_tags(*))`)
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (error || !data) return null
    return rowToPost(data as BlogPostRow)
  } catch {
    return null
  }
}

// --- Unified public API ------------------------------------------------------

export async function getAllPosts(): Promise<BlogPostMeta[]> {
  const [mdx, supabase] = await Promise.all([getMdxPosts(), getSupabasePosts()])
  // Deduplicate by slug — Supabase version wins when both exist
  const bySlug = new Map<string, BlogPostMeta>()
  for (const post of mdx) bySlug.set(post.slug, post)
  for (const post of supabase) bySlug.set(post.slug, post)
  return Array.from(bySlug.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const fromSupabase = await getSupabasePostBySlug(slug)
  if (fromSupabase) return fromSupabase
  return getMdxPostBySlug(slug)
}

// --- Tag helpers (MDX only for now) ------------------------------------------

export function getAllTags(): string[] {
  const tags = new Set<string>()
  getMdxPosts().forEach((post) => post.tags?.forEach((t) => tags.add(t)))
  return Array.from(tags).sort()
}

export function getPostsByTag(tag: string): BlogPostMeta[] {
  return getMdxPosts().filter((post) => post.tags?.includes(tag))
}
