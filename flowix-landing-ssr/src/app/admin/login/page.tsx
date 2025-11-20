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

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Успешный вход, токен сохранен в cookie
        // Обновляем роутер чтобы cookies применились
        router.refresh()
        // Небольшая задержка перед редиректом, чтобы cookies успели установиться
        setTimeout(() => {
          router.push('/admin')
        }, 100)
      } else {
        // Показываем ошибку от сервера
        setError(data.error || 'Неверный email или пароль')
      }
    } catch (err) {
      console.error('[Admin Login] Error:', err)
      setError('Ошибка при входе. Попробуйте позже.')
    } finally {
      setLoading(false)
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

