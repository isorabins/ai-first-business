import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect /admin/* pages (except login) and /api/admin/* API routes
  const isAdminPage = pathname.startsWith('/admin') && pathname !== '/admin/login'
  const isAdminApi = pathname.startsWith('/api/admin')

  if (isAdminPage || isAdminApi) {
    const session = request.cookies.get('admin-session')?.value
    if (session !== 'authenticated') {
      // API routes get 401 JSON; pages get redirected to login
      if (isAdminApi) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  // IMPORTANT: include both page routes AND API routes
  // Missing /api/admin was a security bug we caught in testing
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
