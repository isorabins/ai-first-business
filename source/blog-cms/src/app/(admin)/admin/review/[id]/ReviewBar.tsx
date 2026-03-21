'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { BlogPostStatus } from '@/lib/supabase/types'

interface Props {
  id: string
  title: string
  status: BlogPostStatus
  draftedBy: string
  rejectionNote: string | null
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function ReviewBar({ id, title, status, draftedBy, rejectionNote }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionInput, setRejectionInput] = useState('')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  async function patch(payload: Record<string, unknown>) {
    setLoading(true)
    const res = await fetch(`/api/admin/blog/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)
    return { ok: res.ok, data }
  }

  async function handleApprove() {
    const { ok, data } = await patch({ status: 'published' })
    if (ok) {
      showToast('success', 'Published!')
      router.refresh()
    } else {
      showToast('error', data.error ?? 'Publish failed.')
    }
  }

  async function handleReject() {
    if (!rejectionInput.trim()) return
    const { ok, data } = await patch({ status: 'draft', rejection_note: rejectionInput.trim() })
    setShowRejectModal(false)
    setRejectionInput('')
    if (ok) {
      showToast('success', 'Rejected with note.')
      router.refresh()
    } else {
      showToast('error', data.error ?? 'Rejection failed.')
    }
  }

  return (
    <>
      {/* Sticky review bar */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/admin/blog" className="text-gray-400 hover:text-gray-700 text-sm shrink-0">
            &larr; Blog
          </Link>

          <div className="w-px h-4 bg-gray-200 shrink-0" />

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="font-medium text-gray-900 truncate text-sm">{title}</span>
            <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] ?? ''}`}>
              {status}
            </span>
            {draftedBy === 'ai' && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                AI Draft
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/admin/blog/${id}`}
              className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              Edit
            </Link>
            <button onClick={() => setShowRejectModal(true)} disabled={loading}
              className="text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              Reject
            </button>
            <button onClick={handleApprove} disabled={loading || status === 'published'}
              className="text-sm text-white bg-green-700 hover:bg-green-800 px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50 font-medium">
              {status === 'published' ? 'Published' : 'Approve'}
            </button>
          </div>
        </div>

        {rejectionNote && (
          <div className="max-w-5xl mx-auto px-6 pb-3 text-sm text-amber-700">
            <span className="font-medium">Last rejection note:</span> {rejectionNote}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-lg text-white text-sm z-50 ${
          toast.type === 'success' ? 'bg-green-700' : 'bg-red-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reject Post</h3>
            <p className="text-gray-500 text-sm mb-4">
              Add a note explaining what needs to change.
            </p>
            <textarea value={rejectionInput} onChange={(e) => setRejectionInput(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
              placeholder="The intro needs to be more personal..."
              autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowRejectModal(false); setRejectionInput('') }}
                className="px-4 py-2 text-gray-500 hover:text-gray-800 text-sm">Cancel</button>
              <button onClick={handleReject} disabled={!rejectionInput.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm disabled:opacity-50">
                Send Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
