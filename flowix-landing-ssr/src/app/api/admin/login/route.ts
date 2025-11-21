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
      console.log('[Admin Login API] FastAPI response data keys:', Object.keys(data))
      console.log('[Admin Login API] FastAPI response has access_token:', !!data.access_token)
      console.log('[Admin Login API] FastAPI response has refresh_token:', !!data.refresh_token)
      console.log('[Admin Login API] FastAPI response has admin:', !!data.admin)
      if (data.admin) {
        console.log('[Admin Login API] Admin data:', { id: data.admin.id, email: data.admin.email, role: data.admin.role })
      }
    } catch (e) {
      console.error('[Admin Login API] ❌ Failed to parse JSON response:', e)
      // Если ответ не JSON, возвращаем общую ошибку
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: response.status || 401 }
      )
    }

    if (!response.ok) {
      console.error('[Admin Login API] ❌ FastAPI returned error:', {
        status: response.status,
        detail: data.detail,
        error: data.error
      })
      return NextResponse.json(
        { error: data.detail || data.error || 'Invalid email or password' },
        { status: response.status }
      )
    }

    console.log('[Admin Login API] ✅ FastAPI авторизация успешна, создаем ответ')

    // Сохраняем токен в cookie
    // Также возвращаем токены клиенту для сохранения в localStorage
    const responseData = {
      success: true,
      admin: data.admin,
      access_token: data.access_token,
      refresh_token: data.refresh_token
    }
    
    console.log('[Admin Login API] Response data structure:', {
      hasSuccess: !!responseData.success,
      hasAdmin: !!responseData.admin,
      hasAccessToken: !!responseData.access_token,
      hasRefreshToken: !!responseData.refresh_token
    })

    const nextResponse = NextResponse.json(
      responseData,
      { status: 200 }
    )
    
    console.log('[Admin Login API] Устанавливаем cookies с токенами')

    // Устанавливаем cookies с токенами
    // Определяем, нужно ли использовать secure (только для HTTPS)
    // Проверяем заголовок X-Forwarded-Proto (для reverse proxy как nginx)
    const forwardedProto = request.headers.get('x-forwarded-proto')
    const protocol = forwardedProto || request.nextUrl.protocol.replace(':', '')
    const isSecure = protocol === 'https'
    console.log('[Admin Login API] Protocol check:', {
      'x-forwarded-proto': forwardedProto,
      'request.nextUrl.protocol': request.nextUrl.protocol,
      'final protocol': protocol,
      'isSecure': isSecure
    })
    
    if (data.access_token) {
      const cookieOptions: any = {
        httpOnly: true,
        secure: isSecure, // Используем secure только для HTTPS
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7, // 7 дней (но токен живет 15 минут, refresh будет обновлять)
        path: '/',
      }
      nextResponse.cookies.set('admin_token', data.access_token, cookieOptions)
      console.log('[Admin Login API] ✅ Cookie admin_token установлен с опциями:', {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: cookieOptions.maxAge
      })
    } else {
      console.warn('[Admin Login API] ⚠️ access_token отсутствует, не устанавливаем cookie')
    }
    
    // Сохраняем refresh token
    if (data.refresh_token) {
      const cookieOptions: any = {
        httpOnly: true,
        secure: isSecure, // Используем secure только для HTTPS
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7, // 7 дней
        path: '/',
      }
      nextResponse.cookies.set('admin_refresh_token', data.refresh_token, cookieOptions)
      console.log('[Admin Login API] ✅ Cookie admin_refresh_token установлен с опциями:', {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
        maxAge: cookieOptions.maxAge
      })
    } else {
      console.warn('[Admin Login API] ⚠️ refresh_token отсутствует, не устанавливаем cookie')
    }

    console.log('[Admin Login API] ✅ Ответ готов, отправляем клиенту')
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

