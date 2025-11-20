import { NextRequest, NextResponse } from 'next/server'

// Определяем URL бэкенда
const getApiBaseUrl = (hostname: string): string => {
  const isProduction = hostname.includes('appninjabot.ru') || hostname.includes('flowix.ru')
  
  if (isProduction) {
    return 'https://dev-bot.appninjabot.ru/api'
  }
  
  if (process.env.NEXT_PUBLIC_API_URL) {
    const url = process.env.NEXT_PUBLIC_API_URL
    if (url.includes('localhost')) {
      return url.replace('localhost', 'server')
    }
    return url
  }
  
  return 'http://server:8000/api'
}

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('admin_refresh_token')?.value

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found' },
        { status: 401 }
      )
    }

    const apiBaseUrl = getApiBaseUrl(request.nextUrl.hostname)
    
    // Проксируем запрос к бэкенду FastAPI
    const response = await fetch(`${apiBaseUrl}/v1/admin/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    let data
    try {
      data = await response.json()
    } catch (e) {
      return NextResponse.json(
        { error: 'Failed to refresh token' },
        { status: response.status || 401 }
      )
    }

    if (!response.ok) {
      // Если refresh token невалиден, удаляем cookies
      const errorResponse = NextResponse.json(
        { error: data.detail || data.error || 'Invalid refresh token' },
        { status: response.status }
      )
      errorResponse.cookies.delete('admin_token')
      errorResponse.cookies.delete('admin_refresh_token')
      return errorResponse
    }

    // Обновляем cookies с новыми токенами
    const nextResponse = NextResponse.json(
      { success: true, admin: data.admin },
      { status: 200 }
    )

    nextResponse.cookies.set('admin_token', data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    
    if (data.refresh_token) {
      nextResponse.cookies.set('admin_refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    return nextResponse
  } catch (error) {
    console.error('[Admin Refresh API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}









