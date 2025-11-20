import { NextRequest, NextResponse } from 'next/server'

// Определяем URL бэкенда
const getApiBaseUrl = (): string => {
  // В серверном контексте Next.js (API routes) используем имя сервиса Docker Compose
  // Для серверных запросов из контейнера используем 'server' вместо 'localhost'
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Если переменная задана, используем её (может быть переопределена для серверных запросов)
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

export async function GET(request: NextRequest) {
  return handleRequest(request, 'GET')
}

export async function POST(request: NextRequest) {
  return handleRequest(request, 'POST')
}

export async function PUT(request: NextRequest) {
  return handleRequest(request, 'PUT')
}

export async function DELETE(request: NextRequest) {
  return handleRequest(request, 'DELETE')
}

async function handleRequest(request: NextRequest, method: string, retryOn401: boolean = true) {
  try {
    // Флаг для отслеживания, был ли токен обновлен
    let tokenWasRefreshed = false
    let newRefreshToken: string | undefined = undefined
    
    // Получаем токен из cookie
    let token = request.cookies.get('admin_token')?.value

    // Логируем все cookies для отладки
    const allCookies = request.cookies.getAll()
    console.log('[Admin Proxy API] All cookies:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value })))
    console.log('[Admin Proxy API] Token exists:', !!token)

    // Если токена нет, но есть refresh token, пытаемся обновить
    if (!token) {
      const refreshToken = request.cookies.get('admin_refresh_token')?.value
      if (refreshToken && retryOn401) {
        console.log('[Admin Proxy API] No access token, trying to refresh using refresh token')
        const refreshUrl = getApiBaseUrl()
        const refreshApiResponse = await fetch(`${refreshUrl}/v1/admin/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        if (refreshApiResponse.ok) {
          const refreshApiData = await refreshApiResponse.json()
          token = refreshApiData.access_token
          newRefreshToken = refreshApiData.refresh_token
          tokenWasRefreshed = true
          console.log('[Admin Proxy API] Token refreshed successfully')
        } else {
          console.log('[Admin Proxy API] Refresh failed, status:', refreshApiResponse.status)
          return NextResponse.json(
            { error: 'Unauthorized', detail: 'Token expired and refresh failed' },
            { status: 401 }
          )
        }
      } else {
        console.log('[Admin Proxy API] No token found in cookies and no refresh token available')
        return NextResponse.json(
          { error: 'Unauthorized', detail: 'No authentication token found' },
          { status: 401 }
        )
      }
    }

    // Получаем путь из query параметра
    const { searchParams } = request.nextUrl
    const path = searchParams.get('path')

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      )
    }

    const apiBaseUrl = getApiBaseUrl()
    const url = `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
    
    console.log('[Admin Proxy API] Proxying request:', { method, url, path })

    // Получаем тело запроса для POST/PUT
    let body = null
    if (method === 'POST' || method === 'PUT') {
      try {
        body = await request.json()
      } catch {
        body = null
      }
    }

    // Проксируем запрос к бэкенду
    let response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    
    console.log('[Admin Proxy API] Backend response status:', response.status)

    // Если получили 401 и это первая попытка, пробуем обновить токен
    if (response.status === 401 && retryOn401) {
      // Получаем детали ошибки от бэкенда
      const errorData = await response.json().catch(() => ({ error: 'Failed to parse error' }))
      console.log('[Admin Proxy API] Got 401, error details:', errorData)
      console.log('[Admin Proxy API] Trying to refresh token')
      
      // Пытаемся обновить токен напрямую через бэкенд
      const refreshToken = request.cookies.get('admin_refresh_token')?.value
      if (refreshToken) {
        const refreshUrl = getApiBaseUrl()
        const refreshApiResponse = await fetch(`${refreshUrl}/v1/admin/auth/refresh`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        })

        const refreshResponseData = await refreshApiResponse.json().catch(() => ({ error: 'Failed to parse refresh response' }))
        console.log('[Admin Proxy API] Refresh response status:', refreshApiResponse.status)
        console.log('[Admin Proxy API] Refresh response data:', refreshApiResponse.ok ? { ...refreshResponseData, access_token: '***' } : refreshResponseData)

        if (refreshApiResponse.ok) {
          const refreshApiData = refreshResponseData
          token = refreshApiData.access_token

          // Повторяем оригинальный запрос с новым токеном
          response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: body ? JSON.stringify(body) : undefined,
          })

          // Если успешно, возвращаем ответ с обновленными cookies
          if (response.ok) {
            const data = await response.json().catch(() => ({ error: 'Failed to parse response' }))
            const nextResponse = NextResponse.json(data, { status: response.status })
            
            // Устанавливаем новые cookies
            nextResponse.cookies.set('admin_token', refreshApiData.access_token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7,
              path: '/',
            })
            
            if (refreshApiData.refresh_token) {
              nextResponse.cookies.set('admin_refresh_token', refreshApiData.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7,
                path: '/',
              })
            }
            
            return nextResponse
          }
        } else {
          console.log('[Admin Proxy API] Refresh token failed, status:', refreshApiResponse.status)
          // Если refresh не удался, удаляем невалидные cookies
          const errorResponse = NextResponse.json(
            { error: 'Unauthorized', detail: refreshResponseData.detail || refreshResponseData.error || 'Token refresh failed' },
            { status: 401 }
          )
          errorResponse.cookies.delete('admin_token')
          errorResponse.cookies.delete('admin_refresh_token')
          return errorResponse
        }
      } else {
        console.log('[Admin Proxy API] No refresh token found')
        // Если нет refresh token, удаляем невалидный access token
        const errorResponse = NextResponse.json(
          { error: 'Unauthorized', detail: errorData.detail || errorData.error || 'No refresh token available' },
          { status: 401 }
        )
        errorResponse.cookies.delete('admin_token')
        return errorResponse
      }
    }

    const data = await response.json().catch(() => ({ error: 'Failed to parse response' }))

    // Если токен был обновлен в начале, устанавливаем новые cookies
    const nextResponse = NextResponse.json(data, { status: response.status })
    
    if (tokenWasRefreshed && token) {
      nextResponse.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
      
      if (newRefreshToken) {
        nextResponse.cookies.set('admin_refresh_token', newRefreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        })
      }
    }

    return nextResponse
  } catch (error) {
    console.error('[Admin Proxy API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

