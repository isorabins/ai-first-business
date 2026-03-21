'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BlogCategory, BlogPostRow } from '@/lib/supabase/types'

interface Props {
  post: BlogPostRow
  categories: BlogCategory[]
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  published: 'bg-green-50 text-green-700 border border-green-200',
  archived: 'bg-gray-100 text-gray-500 border border-gray-200',
}

export default function AdminBlogEditor({ post, categories }: Props) {
  const router = useRouter()

  const [title, setTitle] = useState(post.title)
  const [slug, setSlug] = useState(post.slug)
  const [excerpt, setExcerpt] = useState(post.excerpt ?? '')
  const [content, setContent] = useState(post.content)
  const [categoryId, setCategoryId] = useState(post.category_id ?? '')
  const [featuredImage, setFeaturedImage] = useState(post.featured_image ?? '')
  const [metaTitle, setMetaTitle] = useState(post.meta_title ?? '')
  const [metaDescription, setMetaDescription] = useState(post.meta_description ?? '')
  const [preview, setPreview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [rejectionNote, setRejectionNote] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function buildPayload(extra: Record<string, unknown> = {}) {
    return {
      title,
      slug,
      excerpt: excerpt || null,
      content,
      category_id: categoryId || null,
      featured_image: featuredImage || null,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      ...extra,
    }
  }

  async function patch(payload: Record<string, unknown>) {
    setLoading(true)
    const res = await fetch(`/api/admin/blog/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)
    return { ok: res.ok, data }
  }

  async function handleSaveDraft() {
    const { ok, data } = await patch(buildPayload())
    if (ok) showToast('success', 'Draft saved.')
    else showToast('error', data.error ?? 'Save failed.')
  }

  async function handlePublish() {
    const { ok, data } = await patch(buildPayload({ status: 'published' }))
    if (ok) { showToast('success', 'Published!'); router.refresh() }
    else showToast('error', data.error ?? 'Publish failed.')
  }

  async function handleArchive() {
    const { ok, data } = await patch({ status: 'archived' })
    if (ok) { showToast('success', 'Archived.'); router.refresh() }
    else showToast('error', data.error ?? 'Archive failed.')
  }

  async function handleReject() {
    if (!rejectionNote.trim()) return
    const { ok, data } = await patch({ status: 'draft', rejection_note: rejectionNote.trim() })
    setShowRejectModal(false)
    if (ok) { showToast('success', 'Rejection sent.'); router.refresh() }
    else showToast('error', data.error ?? 'Rejection failed.')
  }

  async function handleDelete() {
    if (!confirm('Delete this post permanently?')) return
    setLoading(true)
    const res = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) router.push('/admin/blog')
    else { const data = await res.json(); showToast('error', data.error ?? 'Delete failed.') }
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-5 py-3 rounded-lg shadow-lg text-white text-sm z-50 ${
          toast.type === 'success' ? 'bg-gray-900' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog" className="text-xs uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors">
            &larr; Blog
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm text-gray-900 truncate max-w-xs">{post.title}</span>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ${STATUS_STYLES[post.status] ?? ''}`}>
            {post.status}
          </span>
          {post.drafted_by === 'ai' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-gray-50 text-gray-600 border border-gray-200">
              AI Draft
            </span>
          )}
        </div>
      </div>

      {/* Rejection banner */}
      {post.rejection_note && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          <strong className="font-medium">Rejection note:</strong> {post.rejection_note}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 text-lg focus:outline-none focus:border-gray-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Slug</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 font-mono text-sm focus:outline-none focus:border-gray-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Excerpt</label>
              <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-gray-900 resize-none focus:outline-none focus:border-gray-500 transition-colors text-sm" />
            </div>
          </div>

          {/* Content editor */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-100">
              <button onClick={() => setPreview(false)}
                className={`px-4 py-1.5 rounded-md text-xs uppercase tracking-widest transition-colors ${
                  !preview ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'
                }`}>Edit</button>
              <button onClick={() => setPreview(true)}
                className={`px-4 py-1.5 rounded-md text-xs uppercase tracking-widest transition-colors ${
                  preview ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'
                }`}>Preview</button>
            </div>

            {preview ? (
              <div className="p-6 prose prose-sm max-w-none text-gray-900">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{content}</pre>
              </div>
            ) : (
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={28}
                className="w-full px-6 py-5 text-sm font-mono text-gray-900 resize-none focus:outline-none border-none leading-relaxed"
                placeholder="Write markdown content here..." />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">Actions</p>
            <button onClick={handlePublish} disabled={loading}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm">Publish</button>
            <button onClick={handleSaveDraft} disabled={loading}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-200 py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm">Save Draft</button>
            <button onClick={() => setShowRejectModal(true)} disabled={loading}
              className="w-full bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm">Reject</button>
            <button onClick={handleArchive} disabled={loading}
              className="w-full text-gray-500 hover:text-gray-900 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm">Archive</button>
            <div className="border-t border-gray-100 pt-2">
              <button onClick={handleDelete} disabled={loading}
                className="w-full text-red-400 hover:text-red-600 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 text-sm">Delete</button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <p className="text-xs uppercase tracking-widest text-gray-500">Settings</p>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-gray-500 transition-colors">
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Featured Image URL</label>
              <input value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-gray-500 transition-colors"
                placeholder="https://..." />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <p className="text-xs uppercase tracking-widest text-gray-500">SEO</p>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Meta Title</label>
              <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-gray-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Meta Description</label>
              <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-gray-900 text-sm resize-none focus:outline-none focus:border-gray-500 transition-colors" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Info</p>
            <div className="text-xs text-gray-500 space-y-1.5">
              <div className="flex justify-between">
                <span>Drafted by</span>
                <span className="text-gray-900">{post.drafted_by}</span>
              </div>
              <div className="flex justify-between">
                <span>Created</span>
                <span className="text-gray-900">{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              {post.published_at && (
                <div className="flex justify-between">
                  <span>Published</span>
                  <span className="text-gray-900">{new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">Reject Post</p>
            <h3 className="text-2xl font-light text-gray-900 mb-2">Send feedback</h3>
            <p className="text-sm text-gray-500 mb-6">
              Explain what needs to change. The author will see this note and revise.
            </p>
            <textarea value={rejectionNote} onChange={(e) => setRejectionNote(e.target.value)} rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 text-sm resize-none focus:outline-none focus:border-gray-500 transition-colors mb-5"
              placeholder="The intro needs to be more personal..." autoFocus />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowRejectModal(false)}
                className="px-5 py-2.5 text-gray-500 hover:text-gray-900 text-sm transition-colors">Cancel</button>
              <button onClick={handleReject} disabled={!rejectionNote.trim()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm disabled:opacity-50 transition-colors">Send Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
