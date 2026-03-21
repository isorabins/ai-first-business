import { notFound } from 'next/navigation'
import Image from 'next/image'
import { compileMDX } from 'next-mdx-remote/rsc'
import { createAdminClient } from '@/lib/supabase/admin'
import ReviewBar from './ReviewBar'

// Map internal author IDs to display names — customize for your team
const AUTHOR_DISPLAY_NAMES: Record<string, string> = {
  ai: 'AI Assistant',
  // Add your team: 'jane': 'Jane', 'bob': 'Bob', etc.
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminReviewPage({ params }: Props) {
  const { id } = await params
  const db = createAdminClient()

  const { data: post, error } = await db
    .from('blog_posts')
    .select(`*, blog_categories(*), blog_post_tags(blog_tags(*))`)
    .eq('id', id)
    .single()

  if (error || !post) notFound()

  const { content } = await compileMDX({
    source: post.content,
    options: { parseFrontmatter: false },
  })

  const tags = post.blog_post_tags?.map(
    (t: { blog_tags: { name: string } }) => t.blog_tags.name
  ) ?? []

  const displayDate = post.published_at ?? post.created_at

  return (
    <div className="-mx-6 -mt-6">
      <ReviewBar
        id={post.id}
        title={post.title}
        status={post.status}
        draftedBy={post.drafted_by}
        rejectionNote={post.rejection_note}
      />

      {/* Rendered post preview */}
      <article className="pb-16">
        <header className="max-w-3xl mx-auto px-6 py-12">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map((tag: string) => (
                <span key={tag}
                  className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-gray-900 mb-6">
            {post.title}
          </h1>

          <div className="flex items-center gap-4 text-gray-600">
            <span>{AUTHOR_DISPLAY_NAMES[post.author_id] ?? post.author_id}</span>
            <span>&bull;</span>
            <time dateTime={displayDate}>
              {new Date(displayDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
            {post.blog_categories?.name && (
              <>
                <span>&bull;</span>
                <span>{post.blog_categories.name}</span>
              </>
            )}
          </div>
        </header>

        {post.featured_image && (
          <div className="max-w-5xl mx-auto px-6 mb-12">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden">
              <Image
                src={post.featured_image}
                alt={post.title}
                fill
                className="object-cover"
                priority
                sizes="100vw"
                quality={95}
              />
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto px-6">
          <div className="prose prose-lg max-w-none">
            {content}
          </div>
        </div>
      </article>
    </div>
  )
}
