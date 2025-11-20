import { NextRequest, NextResponse } from 'next/server'

// Определяем URL бэкенда в зависимости от окружения
const getApiBaseUrl = (hostname: string): string => {
  // Определяем по hostname
  const isProduction = hostname.includes('appninjabot.ru') || hostname.includes('flowix.ru')
  
  if (isProduction) {
    return 'https://dev-bot.appninjabot.ru/api'
  }
  
  // В серверном контексте Next.js (API routes) используем имя сервиса Docker Compose
  // Для серверных запросов из контейнера используем 'server' вместо 'localhost'
  if (process.env.NEXT_PUBLIC_API_URL) {
    const url = process.env.NEXT_PUBLIC_API_URL
    // Если это localhost, заменяем на имя сервиса для серверных запросов
    if (url.includes('localhost')) {
      return url.replace('localhost', 'server')
    }
    return url
  }
  
  // По умолчанию используем имя сервиса Docker Compose
  return 'http://server:8000/api'
}

export async function GET() {
  return NextResponse.json({ message: 'Admin login API route is working' })
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Admin Login API] POST request received')
    const body = await request.json()
    console.log('[Admin Login API] Body:', { email: body.email, password: '***' })
    const { email, password } = body

    if (!email || !password) {
      console.log('[Admin Login API] Missing email or password')
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const apiBaseUrl = getApiBaseUrl(request.nextUrl.hostname)
    console.log('[Admin Login API] Hostname:', request.nextUrl.hostname)
    console.log('[Admin Login API] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL)
    console.log('[Admin Login API] NODE_ENV:', process.env.NODE_ENV)
    console.log('[Admin Login API] Proxying to:', `${apiBaseUrl}/v1/admin/auth/login`)
    
    // Проксируем запрос к бэкенду FastAPI
    const response = await fetch(`${apiBaseUrl}/v1/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    console.log('[Admin Login API] FastAPI response status:', response.status)
    let data
    try {
      data = await response.json()
      console.log('[Admin Login API] FastAPI response data:', { ...data, access_token: data.access_token ? '***' : undefined })
    } catch (e) {
      console.error('[Admin Login API] Failed to parse JSON response:', e)
      // Если ответ не JSON, возвращаем общую ошибку
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: response.status || 401 }
      )
    }

    if (!response.ok) {
      console.log('[Admin Login API] FastAPI returned error:', data)
      return NextResponse.json(
        { error: data.detail || data.error || 'Invalid email or password' },
        { status: response.status }
      )
    }

    // Сохраняем токен в cookie
    const nextResponse = NextResponse.json(
      { success: true, admin: data.admin },
      { status: 200 }
    )

    // Устанавливаем cookies с токенами
    nextResponse.cookies.set('admin_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 дней (но токен живет 15 минут, refresh будет обновлять)
      path: '/',
    })
    
    // Сохраняем refresh token
    if (data.refresh_token) {
      nextResponse.cookies.set('admin_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 дней
        path: '/',
      })
    }

    return nextResponse
  } catch (error) {
    console.error('[Admin Login API] Error:', error)
    if (error instanceof Error) {
      console.error('[Admin Login API] Error message:', error.message)
      console.error('[Admin Login API] Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

