'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import '@/styles/admin-variables.css'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    console.log('[Admin Login] Начало авторизации')
    console.log('[Admin Login] Email:', email)

    try {
      console.log('[Admin Login] Отправка запроса на /api/admin/login')
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      console.log('[Admin Login] Ответ получен, статус:', response.status)
      console.log('[Admin Login] Headers:', Object.fromEntries(response.headers.entries()))

      const data = await response.json()
      console.log('[Admin Login] Данные ответа:', {
        success: data.success,
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        hasAdmin: !!data.admin,
        admin: data.admin ? { id: data.admin.id, email: data.admin.email, role: data.admin.role } : null
      })

      if (response.ok) {
        console.log('[Admin Login] ✅ Авторизация успешна')
        
        // Успешный вход, сохраняем токены в localStorage для клиентского доступа
        if (data.access_token) {
          localStorage.setItem('admin_access_token', data.access_token)
          console.log('[Admin Login] ✅ access_token сохранен в localStorage')
        } else {
          console.warn('[Admin Login] ⚠️ access_token отсутствует в ответе')
        }
        
        if (data.refresh_token) {
          localStorage.setItem('admin_refresh_token', data.refresh_token)
          console.log('[Admin Login] ✅ refresh_token сохранен в localStorage')
        } else {
          console.warn('[Admin Login] ⚠️ refresh_token отсутствует в ответе')
        }
        
        // Также сохраняем информацию об админе
        if (data.admin) {
          localStorage.setItem('admin_user', JSON.stringify(data.admin))
          console.log('[Admin Login] ✅ Информация об админе сохранена в localStorage')
        } else {
          console.warn('[Admin Login] ⚠️ Данные админа отсутствуют в ответе')
        }
        
        // Проверяем, что токены действительно сохранились
        const savedAccessToken = localStorage.getItem('admin_access_token')
        const savedRefreshToken = localStorage.getItem('admin_refresh_token')
        console.log('[Admin Login] Проверка сохранения:', {
          accessTokenSaved: !!savedAccessToken,
          refreshTokenSaved: !!savedRefreshToken,
          accessTokenLength: savedAccessToken?.length || 0
        })
        
        console.log('[Admin Login] Обновление роутера и редирект на /admin')
        // Обновляем роутер чтобы cookies применились
        router.refresh()
        // Небольшая задержка перед редиректом, чтобы cookies успели установиться
        setTimeout(() => {
          console.log('[Admin Login] Выполнение редиректа на /admin')
          router.push('/admin')
        }, 100)
      } else {
        console.error('[Admin Login] ❌ Ошибка авторизации:', {
          status: response.status,
          error: data.error,
          detail: data.detail
        })
        // Показываем ошибку от сервера
        setError(data.error || data.detail || 'Неверный email или пароль')
      }
    } catch (err) {
      console.error('[Admin Login] ❌ Исключение при авторизации:', err)
      if (err instanceof Error) {
        console.error('[Admin Login] Сообщение об ошибке:', err.message)
        console.error('[Admin Login] Stack trace:', err.stack)
      }
      setError('Ошибка при входе. Попробуйте позже.')
    } finally {
      setLoading(false)
      console.log('[Admin Login] Завершение обработки, loading установлен в false')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--background-color)',
    }}>
      <div style={{
        maxWidth: '400px',
        width: '100%',
        padding: '32px',
        backgroundColor: 'var(--card-background)',
        borderRadius: '12px',
        border: `1px solid var(--border-color)`,
      }}>
        <div>
          <h2 style={{
            marginTop: '0',
            marginBottom: '32px',
            textAlign: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            color: 'var(--text-color)',
          }}>
            Вход в админ-панель
          </h2>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {error && (
            <div style={{
              backgroundColor: 'var(--error-background)',
              border: `1px solid var(--error-color)`,
              color: 'var(--error-color)',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div>
              <label htmlFor="email" style={{ display: 'none' }}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px 8px 0 0',
                  fontSize: '14px',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-background)',
                  outline: 'none',
                }}
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--primary-color)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-color)'
                }}
              />
            </div>
            <div>
              <label htmlFor="password" style={{ display: 'none' }}>
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid var(--border-color)`,
                  borderTop: 'none',
                  borderRadius: '0 0 8px 8px',
                  fontSize: '14px',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-background)',
                  outline: 'none',
                }}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--primary-color)'
                  e.target.style.borderTopWidth = '1px'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-color)'
                  e.target.style.borderTopWidth = '0'
                }}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 500,
                borderRadius: '8px',
                border: 'none',
                color: '#ffffff',
                backgroundColor: loading ? 'var(--gray-400)' : 'var(--primary-color)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

