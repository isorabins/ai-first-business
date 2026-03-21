'use client'

import { useState } from 'react'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Login failed.')
      return
    }

    // IMPORTANT: use window.location.href, not router.push()
    // router.push does a soft navigation — the browser won't re-send
    // the newly set cookie, so middleware rejects it on the next request.
    window.location.href = '/admin/blog'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="mb-10 text-center">
        <p className="text-xl font-medium text-gray-900">Your Site</p>
        <p className="text-xs uppercase tracking-widest text-gray-500 mt-1">
          Content Management
        </p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-500 transition-colors text-sm"
            required
            autoFocus
          />

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-lg transition-colors disabled:opacity-50 text-sm tracking-wide"
          >
            {loading ? 'Signing in...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}
