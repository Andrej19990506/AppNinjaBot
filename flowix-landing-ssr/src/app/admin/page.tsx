'use client'

import Link from 'next/link'
import '@/styles/admin-variables.css'

export default function AdminDashboard() {
  return (
    <div>
      <h1 style={{
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '24px',
        color: 'var(--text-color)',
      }}>
        Админ-панель Flowix
      </h1>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '32px',
      }}>
        <Link
          href="/admin/companies"
          style={{
            textDecoration: 'none',
            display: 'block',
          }}
        >
          <div style={{
            backgroundColor: 'var(--card-background)',
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid var(--border-color)`,
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
          >
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-color)',
            }}>
              Компании
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
            }}>
              Управление компаниями и ботами
            </p>
          </div>
        </Link>
        
        <Link
          href="/admin/users"
          style={{
            textDecoration: 'none',
            display: 'block',
          }}
        >
          <div style={{
            backgroundColor: 'var(--card-background)',
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid var(--border-color)`,
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
          >
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-color)',
            }}>
              Администраторы
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
            }}>
              Управление администраторами системы
            </p>
          </div>
        </Link>
        
        <Link
          href="/admin/roles"
          style={{
            textDecoration: 'none',
            display: 'block',
          }}
        >
          <div style={{
            backgroundColor: 'var(--card-background)',
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid var(--border-color)`,
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
          >
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-color)',
            }}>
              Роли
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
            }}>
              Настройка ролей для компаний
            </p>
          </div>
        </Link>
        
        <Link
          href="/admin/groups"
          style={{
            textDecoration: 'none',
            display: 'block',
          }}
        >
          <div style={{
            backgroundColor: 'var(--card-background)',
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid var(--border-color)`,
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
          >
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              marginBottom: '8px',
              color: 'var(--text-color)',
            }}>
              Группы
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
            }}>
              Привязка ролей к группам
            </p>
          </div>
        </Link>
      </div>
      
      <div style={{
        backgroundColor: 'var(--card-background)',
        borderRadius: '12px',
        padding: '24px',
        border: `1px solid var(--border-color)`,
      }}>
        <h2 style={{
          fontSize: '18px',
          fontWeight: 600,
          marginBottom: '16px',
          color: 'var(--text-color)',
        }}>
          Последние действия
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
        }}>
          Здесь будут отображаться последние действия...
        </p>
      </div>
    </div>
  )
}

