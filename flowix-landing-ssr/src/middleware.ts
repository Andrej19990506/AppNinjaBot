import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Проверяем, если это админ-роут
  if (pathname.startsWith('/admin')) {
    // Проверяем наличие токена в cookies
    const token = request.cookies.get('admin_token')
    const refreshToken = request.cookies.get('admin_refresh_token')
    
    console.log('[Middleware] Проверка авторизации для:', pathname)
    console.log('[Middleware] admin_token:', token ? 'present' : 'missing')
    console.log('[Middleware] admin_refresh_token:', refreshToken ? 'present' : 'missing')
    console.log('[Middleware] Все cookies:', request.cookies.getAll().map(c => c.name))
    
    // Проверяем наличие хотя бы одного токена (access или refresh)
    const hasToken = token || refreshToken
    
    // Если нет токена и не на странице логина - редирект
    if (!hasToken && !pathname.startsWith('/admin/login')) {
      console.log('[Middleware] ❌ Нет токена, редирект на /admin/login')
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    // Если есть токен и на странице логина - редирект на dashboard
    if (hasToken && pathname.startsWith('/admin/login')) {
      console.log('[Middleware] ✅ Токен найден, редирект с /admin/login на /admin')
      return NextResponse.redirect(new URL('/admin', request.url))
    }
    
    console.log('[Middleware] ✅ Авторизация пройдена, разрешаем доступ')
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}

