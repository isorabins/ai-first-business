import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BlogPostRow } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  published: 'bg-green-50 text-green-700 border border-green-200',
  archived: 'bg-gray-100 text-gray-500 border border-gray-200',
}

export default async function AdminBlogPage() {
  let posts: BlogPostRow[] = []

  try {
    const db = createAdminClient()
    const { data } = await db
      .from('blog_posts')
      .select(`*, blog_categories(name)`)
      .order('created_at', { ascending: false })
    posts = (data as BlogPostRow[]) ?? []
  } catch {
    // Supabase not configured — show empty state
  }

  const drafts = posts.filter((p) => p.status === 'draft')
  const published = posts.filter((p) => p.status === 'published')
  const archived = posts.filter((p) => p.status === 'archived')

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-3xl font-light text-gray-900">Blog Posts</h1>
        <div className="flex gap-4 text-xs uppercase tracking-widest text-gray-500">
          <span>{drafts.length} drafts</span>
          <span>·</span>
          <span>{published.length} published</span>
          <span>·</span>
          <span>{archived.length} archived</span>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-16 text-center text-gray-500 text-sm">
          No blog posts yet. Submit a draft via the API to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs uppercase tracking-widest text-gray-500 font-normal">Title</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-widest text-gray-500 font-normal">Status</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-widest text-gray-500 font-normal">Author</th>
                <th className="px-4 py-4 text-left text-xs uppercase tracking-widest text-gray-500 font-normal">Date</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{post.title}</div>
                    <div className="text-gray-500 text-xs mt-0.5">/blog/{post.slug}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${STATUS_STYLES[post.status] ?? ''}`}>
                      {post.status}
                    </span>
                    {post.rejection_note && post.status === 'draft' && (
                      <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200">
                        needs revision
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-gray-900">
                      {post.drafted_by}
                      {post.drafted_by === 'ai' && (
                        <span className="ml-2 text-xs bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">AI</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-gray-500 text-xs">
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/admin/review/${post.id}`}
                      className="text-xs uppercase tracking-widest text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
