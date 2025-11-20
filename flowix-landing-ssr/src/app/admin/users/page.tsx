'use client'

import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface AdminUser {
  id: number
  email: string
  name: string | null
  role: 'super_admin' | 'company_admin'
  company_bot_id: number | null
  is_active: boolean
  created_at: string
  last_login: string | null
}

interface CompanyBot {
  id: number
  company_name: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [companies, setCompanies] = useState<CompanyBot[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'company_admin' as 'super_admin' | 'company_admin',
    company_bot_id: null as number | null,
    is_active: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [usersData, companiesData] = await Promise.all([
        adminApi.getAdminUsers(),
        adminApi.getCompanies(),
      ])
      setUsers(usersData)
      setCompanies(companiesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const payload: any = {
        email: formData.email,
        name: formData.name || null,
        role: formData.role,
        is_active: formData.is_active,
      }

      if (formData.role === 'company_admin') {
        if (!formData.company_bot_id) {
          setError('Необходимо выбрать компанию для админа компании')
          return
        }
        payload.company_bot_id = formData.company_bot_id
      }

      if (editingUser) {
        // При редактировании пароль опционален
        if (formData.password) {
          payload.password = formData.password
        }
        const updatedUser = await adminApi.updateAdminUser(editingUser.id, payload)
        setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u))
        setSuccess('Администратор успешно обновлен!')
        setEditingUser(null)
        setShowCreateForm(false)
      } else {
        // При создании пароль обязателен
        if (!formData.password || formData.password.length < 8) {
          setError('Пароль должен содержать минимум 8 символов')
          return
        }
        payload.password = formData.password
        const newUser = await adminApi.createAdminUser(payload)
        setUsers([...users, newUser])
        setSuccess('Администратор успешно создан!')
        setShowCreateForm(false)
      }
      setFormData({
        email: '',
        password: '',
        name: '',
        role: 'company_admin',
        company_bot_id: null,
        is_active: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении администратора')
    }
  }

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      password: '', // Не показываем пароль
      name: user.name || '',
      role: user.role,
      company_bot_id: user.company_bot_id,
      is_active: user.is_active,
    })
    setShowCreateForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleDelete = async (userId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этого администратора?')) {
      return
    }

    try {
      await adminApi.deleteAdminUser(userId)
      setUsers(users.filter(u => u.id !== userId))
      setSuccess('Администратор успешно удален!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении администратора')
    }
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingUser(null)
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'company_admin',
      company_bot_id: null,
      is_active: true,
    })
    setError(null)
    setSuccess(null)
  }

  const getCompanyName = (companyBotId: number | null) => {
    if (!companyBotId) return '-'
    const company = companies.find(c => c.id === companyBotId)
    return company?.company_name || `ID: ${companyBotId}`
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Загрузка...</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: 'var(--text-color)',
        }}>
          Администраторы
        </h1>
        {!showCreateForm && (
          <button
            onClick={() => {
              setShowCreateForm(true)
              setEditingUser(null)
              setFormData({
                email: '',
                password: '',
                name: '',
                role: 'company_admin',
                company_bot_id: null,
                is_active: true,
              })
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Создать администратора
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--error-background)',
          color: 'var(--error-color)',
          borderRadius: '8px',
          marginBottom: '16px',
          border: `1px solid var(--error-color)`,
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'var(--success-background)',
          color: 'var(--success-color)',
          borderRadius: '8px',
          marginBottom: '16px',
          border: `1px solid var(--success-color)`,
        }}>
          {success}
        </div>
      )}

      {showCreateForm && (
        <div style={{
          backgroundColor: 'var(--card-background)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: `1px solid var(--border-color)`,
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '24px',
            color: 'var(--text-color)',
          }}>
            {editingUser ? 'Редактировать администратора' : 'Создать администратора'}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  padding: '12px 16px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-background)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>
                Пароль {editingUser ? '(оставьте пустым, чтобы не менять)' : '*'}
              </label>
              <input
                type="password"
                required={!editingUser}
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={{
                  padding: '12px 16px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-background)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>
                Имя
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  padding: '12px 16px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-background)',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>
                Роль *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  role: e.target.value as 'super_admin' | 'company_admin',
                  company_bot_id: e.target.value === 'super_admin' ? null : formData.company_bot_id
                })}
                style={{
                  padding: '12px 16px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: 'var(--text-color)',
                  backgroundColor: 'var(--card-background)',
                  outline: 'none',
                }}
              >
                <option value="super_admin">Суперадмин</option>
                <option value="company_admin">Админ компании</option>
              </select>
            </div>

            {formData.role === 'company_admin' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-color)' }}>
                  Компания *
                </label>
                <select
                  required
                  value={formData.company_bot_id || ''}
                  onChange={(e) => setFormData({ ...formData, company_bot_id: e.target.value ? parseInt(e.target.value) : null })}
                  style={{
                    padding: '12px 16px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: 'var(--text-color)',
                    backgroundColor: 'var(--card-background)',
                    outline: 'none',
                  }}
                >
                  <option value="">Выберите компанию</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.company_name || `Компания #${company.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <label style={{ fontSize: '14px', color: 'var(--text-color)', cursor: 'pointer' }}>
                Активен
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {editingUser ? 'Сохранить' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: 'var(--text-color)',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{
        backgroundColor: 'var(--card-background)',
        borderRadius: '12px',
        border: `1px solid var(--border-color)`,
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--background-color)', borderBottom: `1px solid var(--border-color)` }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>ID</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>Email</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>Имя</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>Роль</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>Компания</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>Статус</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Нет администраторов
                </td>
              </tr>
            ) : (
              users.map(user => (
                <tr key={user.id} style={{ borderBottom: `1px solid var(--border-color)` }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-color)' }}>{user.id}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-color)' }}>{user.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-color)' }}>{user.name || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-color)' }}>
                    {user.role === 'super_admin' ? 'Суперадмин' : 'Админ компании'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-color)' }}>
                    {getCompanyName(user.company_bot_id)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: 'var(--text-color)' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 500,
                      backgroundColor: user.is_active ? 'var(--success-background)' : 'var(--error-background)',
                      color: user.is_active ? 'var(--success-color)' : 'var(--error-color)',
                    }}>
                      {user.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEdit(user)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'transparent',
                          color: 'var(--primary-color)',
                          border: `1px solid var(--primary-color)`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'transparent',
                          color: 'var(--error-color)',
                          border: `1px solid var(--error-color)`,
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

