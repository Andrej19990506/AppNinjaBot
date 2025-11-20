'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface CompanyBot {
  id: number
  bot_token: string
  bot_username: string | null
  bot_id: number | null
  group_id: number | null
  company_name: string | null
  is_active: boolean
  bot_metadata: string | null
  created_at: string
  updated_at: string
}

export default function CompaniesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyBot[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyBot | null>(null)
  const [formData, setFormData] = useState({
    bot_token: '',
    company_name: '',
    bot_username: '',
    bot_id: '',
    is_active: true,
  })
  const [createAdmin, setCreateAdmin] = useState(false)
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    name: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [verifyingToken, setVerifyingToken] = useState(false)
  const [tokenVerifyError, setTokenVerifyError] = useState<string | null>(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

  // Debounce для проверки токена
  useEffect(() => {
    if (!formData.bot_token || editingCompany) {
      return
    }

    // Проверяем формат токена (должен содержать :)
    if (!formData.bot_token.includes(':')) {
      return
    }

    // Минимальная длина токена
    if (formData.bot_token.length < 20) {
      return
    }

    const timeoutId = setTimeout(async () => {
      setVerifyingToken(true)
      setTokenVerifyError(null)
      
      try {
        const botInfo = await adminApi.verifyBotToken(formData.bot_token)
        
        // Автоматически заполняем поля
        setFormData(prev => {
          const updates: any = {
            bot_id: botInfo.bot_id?.toString() || '',
            bot_username: botInfo.bot_username || '',
          }
          
          // Если название компании не заполнено, можно использовать first_name бота
          if (!prev.company_name && botInfo.first_name) {
            updates.company_name = botInfo.first_name
          }
          
          return { ...prev, ...updates }
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Ошибка при проверке токена'
        setTokenVerifyError(errorMessage)
        // Очищаем поля при ошибке
        setFormData(prev => ({
          ...prev,
          bot_id: '',
          bot_username: '',
        }))
      } finally {
        setVerifyingToken(false)
      }
    }, 1000) // Задержка 1 секунда после окончания ввода

    return () => clearTimeout(timeoutId)
  }, [formData.bot_token, editingCompany])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const data = await adminApi.getCompanies()
      setCompanies(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке компаний')
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
        bot_token: formData.bot_token,
        company_name: formData.company_name || null,
        is_active: true,
      }

      if (formData.bot_username) {
        payload.bot_username = formData.bot_username
      }

      if (formData.bot_id) {
        payload.bot_id = parseInt(formData.bot_id)
      }

      payload.is_active = formData.is_active

      if (editingCompany) {
        // При редактировании не отправляем bot_token (он не должен изменяться)
        delete payload.bot_token
        const updatedCompany = await adminApi.updateCompany(editingCompany.id, payload)
        setCompanies(companies.map(c => c.id === editingCompany.id ? updatedCompany : c))
        setSuccess('Компания успешно обновлена!')
        setEditingCompany(null)
        setShowCreateForm(false)
      } else {
        const newCompany = await adminApi.createCompany(payload)
        setCompanies([...companies, newCompany])
        
        // Если нужно создать админа компании
        if (createAdmin && adminFormData.email && adminFormData.password) {
          try {
            await adminApi.createAdminUser({
              email: adminFormData.email,
              password: adminFormData.password,
              name: adminFormData.name || null,
              role: 'company_admin',
              company_bot_id: newCompany.id,
            })
            setSuccess('Компания и администратор успешно созданы!')
          } catch (adminErr) {
            setSuccess('Компания создана, но не удалось создать администратора: ' + (adminErr instanceof Error ? adminErr.message : 'Неизвестная ошибка'))
          }
        } else {
          setSuccess('Компания успешно создана!')
        }
        
        setShowCreateForm(false)
      }
      setFormData({
        bot_token: '',
        company_name: '',
        bot_username: '',
        bot_id: '',
        is_active: true,
      })
      setCreateAdmin(false)
      setAdminFormData({
        email: '',
        password: '',
        name: '',
      })
      setTokenVerifyError(null)
      setVerifyingToken(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании компании')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  const handleEdit = (company: CompanyBot) => {
    setEditingCompany(company)
    setShowCreateForm(true)
    setFormData({
      bot_token: company.bot_token,
      company_name: company.company_name || '',
      bot_username: company.bot_username || '',
      bot_id: company.bot_id?.toString() || '',
      is_active: company.is_active,
    })
    setError(null)
    setSuccess(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту компанию?')) {
      return
    }

    try {
      await adminApi.deleteCompany(id)
      setCompanies(companies.filter(c => c.id !== id))
      setSuccess('Компания успешно удалена!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении компании')
    }
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingCompany(null)
    setFormData({
      bot_token: '',
      company_name: '',
      bot_username: '',
      bot_id: '',
      is_active: true,
    })
    setCreateAdmin(false)
    setAdminFormData({
      email: '',
      password: '',
      name: '',
    })
    setError(null)
    setSuccess(null)
    setTokenVerifyError(null)
    setVerifyingToken(false)
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
          Компании
        </h1>
        {!showCreateForm && (
          <button
            onClick={() => {
              setShowCreateForm(true)
              setEditingCompany(null)
              setFormData({
                bot_token: '',
                company_name: '',
                bot_username: '',
                bot_id: '',
                is_active: true,
              })
              setTokenVerifyError(null)
              setVerifyingToken(false)
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
            + Создать компанию
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
          border: `1px solid var(--border-color)`,
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '20px',
            color: 'var(--text-color)',
          }}>
            {editingCompany ? 'Редактировать компанию' : 'Создать новую компанию'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-color)',
              }}>
                Токен бота * (из BotFather)
                {verifyingToken && (
                  <span style={{ 
                    marginLeft: '8px', 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic'
                  }}>
                    Проверка...
                  </span>
                )}
              </label>
              <input
                type="text"
                name="bot_token"
                value={formData.bot_token}
                onChange={handleInputChange}
                required={!editingCompany}
                disabled={!!editingCompany || verifyingToken}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid ${tokenVerifyError ? 'var(--error-color)' : 'var(--border-color)'}`,
                  borderRadius: '8px',
                  backgroundColor: 'var(--background-color)',
                  color: 'var(--text-color)',
                  opacity: verifyingToken ? 0.7 : 1,
                }}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
              {tokenVerifyError && !editingCompany && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--error-color)',
                }}>
                  {tokenVerifyError}
                </div>
              )}
              {!tokenVerifyError && !verifyingToken && formData.bot_token && formData.bot_id && !editingCompany && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'var(--success-color)',
                }}>
                  ✓ Токен проверен, данные бота загружены
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-color)',
              }}>
                Название компании
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  backgroundColor: 'var(--background-color)',
                  color: 'var(--text-color)',
                }}
                placeholder="Ниндзя Пицца"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-color)',
              }}>
                Username бота (опционально)
              </label>
              <input
                type="text"
                name="bot_username"
                value={formData.bot_username}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  backgroundColor: 'var(--background-color)',
                  color: 'var(--text-color)',
                }}
                placeholder="@NinjaSlovtsova_bot"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-color)',
              }}>
                ID бота (опционально, можно получить через getMe API)
              </label>
              <input
                type="number"
                name="bot_id"
                value={formData.bot_id}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  backgroundColor: 'var(--background-color)',
                  color: 'var(--text-color)',
                }}
                placeholder="123456789"
              />
            </div>


            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-color)',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                />
                Активна
              </label>
            </div>

            {!editingCompany && (
              <>
                <div style={{ 
                  marginTop: '24px', 
                  marginBottom: '20px', 
                  paddingTop: '24px', 
                  borderTop: `1px solid var(--border-color)` 
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--text-color)',
                    cursor: 'pointer',
                    marginBottom: '16px',
                  }}>
                    <input
                      type="checkbox"
                      checked={createAdmin}
                      onChange={(e) => setCreateAdmin(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                      }}
                    />
                    Создать администратора компании
                  </label>

                  {createAdmin && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '16px', 
                      backgroundColor: 'var(--background-color)', 
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px',
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-color)',
                        }}>
                          Email администратора *
                        </label>
                        <input
                          type="email"
                          required={createAdmin}
                          value={adminFormData.email}
                          onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: `1px solid var(--border-color)`,
                            borderRadius: '8px',
                            backgroundColor: 'var(--card-background)',
                            color: 'var(--text-color)',
                            outline: 'none',
                          }}
                          placeholder="admin@company.com"
                        />
                      </div>

                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-color)',
                        }}>
                          Пароль администратора * (минимум 8 символов)
                        </label>
                        <input
                          type="password"
                          required={createAdmin}
                          minLength={8}
                          value={adminFormData.password}
                          onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: `1px solid var(--border-color)`,
                            borderRadius: '8px',
                            backgroundColor: 'var(--card-background)',
                            color: 'var(--text-color)',
                            outline: 'none',
                          }}
                          placeholder="Минимум 8 символов"
                        />
                      </div>

                      <div>
                        <label style={{
                          display: 'block',
                          marginBottom: '8px',
                          fontSize: '14px',
                          fontWeight: 500,
                          color: 'var(--text-color)',
                        }}>
                          Имя администратора
                        </label>
                        <input
                          type="text"
                          value={adminFormData.name}
                          onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: `1px solid var(--border-color)`,
                            borderRadius: '8px',
                            backgroundColor: 'var(--card-background)',
                            color: 'var(--text-color)',
                            outline: 'none',
                          }}
                          placeholder="Иван Иванов"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
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
                {editingCompany ? 'Сохранить' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--button-secondary-bg)',
                  color: 'var(--button-secondary-text)',
                  border: 'none',
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

      {loading ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}>
          Загрузка...
        </div>
      ) : companies.length === 0 ? (
        <div style={{
          backgroundColor: 'var(--card-background)',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          border: `1px solid var(--border-color)`,
        }}>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-secondary)',
          }}>
            Компании не найдены. Создайте первую компанию.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px',
        }}>
          {companies.map((company) => (
            <div
              key={company.id}
              style={{
                backgroundColor: 'var(--card-background)',
                borderRadius: '12px',
                padding: '24px',
                border: `1px solid var(--border-color)`,
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
              }}>
                <div>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: 'var(--text-color)',
                  }}>
                    {company.company_name || 'Без названия'}
                  </h3>
                  <p style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    marginBottom: '4px',
                  }}>
                    Бот: {company.bot_username || 'Не указан'}
                  </p>
                </div>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: company.is_active 
                    ? 'var(--success-background)' 
                    : 'var(--error-background)',
                  color: company.is_active 
                    ? 'var(--success-color)' 
                    : 'var(--error-color)',
                }}>
                  {company.is_active ? 'Активна' : 'Неактивна'}
                </div>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
              }}>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}>
                  Создана: {new Date(company.created_at).toLocaleString('ru-RU')}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => router.push(`/admin/companies/${company.id}/roles`)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Роли
                  </button>
                  <button
                    onClick={() => router.push(`/admin/companies/${company.id}/groups`)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--button-secondary-bg)',
                      color: 'var(--button-secondary-text)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Группы
                  </button>
                  <button
                    onClick={() => handleEdit(company)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--button-secondary-bg)',
                      color: 'var(--button-secondary-text)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(company.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--error-background)',
                      color: 'var(--error-color)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

