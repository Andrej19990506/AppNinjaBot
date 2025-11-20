'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import '@/styles/admin-variables.css'

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: '📊' },
  { name: 'Компании', href: '/admin/companies', icon: '🏢' },
  { name: 'Администраторы', href: '/admin/users', icon: '👤' },
  { name: 'Роли', href: '/admin/roles', icon: '👥' },
  { name: 'Группы', href: '/admin/groups', icon: '💬' },
  { name: 'Функции', href: '/admin/features', icon: '⚙️' },
]

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleLogout = async () => {
    try {
      // Удаляем cookies через API route
      await fetch('/api/admin/logout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Редиректим на страницу логина
      router.push('/admin/login')
      router.refresh()
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--background-color)' }}>
      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: sidebarOpen ? '256px' : '0',
          backgroundColor: 'var(--card-background)',
          borderRight: `1px solid var(--border-color)`,
          zIndex: 50,
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '60px',
            padding: '0 24px',
            borderBottom: `1px solid var(--border-color)`,
          }}>
            <Link href="/admin" style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: 'var(--text-color)',
              textDecoration: 'none',
            }}>
              Flowix Admin
            </Link>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '20px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    fontSize: '14px',
                    fontWeight: 500,
                    borderRadius: '8px',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'var(--primary-transparent)' : 'transparent',
                    color: isActive ? 'var(--primary-color)' : 'var(--text-color)',
                  }}
                >
                  <span style={{ marginRight: '12px', fontSize: '18px' }}>{item.icon}</span>
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid var(--border-color)`,
          }}>
            <button 
              onClick={handleLogout}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                fontSize: '14px',
                color: 'var(--text-color)',
                background: 'none',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Выйти
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: sidebarOpen ? '256px' : '0' }}>
        {/* Header */}
        <header style={{
          backgroundColor: 'var(--card-background)',
          borderBottom: `1px solid var(--border-color)`,
          height: '60px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '100%',
            padding: '0 24px',
          }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '20px',
                }}
              >
                ☰
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-color)' }}>Администратор</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ padding: '24px' }}>{children}</main>
      </div>
    </div>
  )
}

