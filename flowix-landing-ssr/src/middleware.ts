import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Проверяем, если это админ-роут
  if (pathname.startsWith('/admin')) {
    // Проверяем наличие токена
    const token = request.cookies.get('admin_token')
    
    // Если нет токена и не на странице логина - редирект
    if (!token && !pathname.startsWith('/admin/login')) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    // Если есть токен и на странице логина - редирект на dashboard
    if (token && pathname.startsWith('/admin/login')) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}

