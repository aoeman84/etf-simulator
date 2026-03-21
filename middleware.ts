import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // API 보호: /api/portfolio, /api/purchase 는 로그인 필요
  if (pathname.startsWith('/api/portfolio') || pathname.startsWith('/api/purchase')) {
    const token = await getToken({ req })
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/portfolio/:path*', '/api/purchase/:path*'],
}
