'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface Group {
  id?: number  // Внутренний ID из БД
  group_id?: number  // Telegram Group ID (может быть как group_id, так и chat_id из-за alias)
  chat_id?: number  // Алиас для group_id в API
  title: string
  group_type: string | null
}

interface CompanyBot {
  id: number
  company_name: string | null
}

interface CompanyRole {
  id: number
  role_name: string
  role_code: string
  icon: string | null
  color: string | null
}

interface GroupRoleMapping {
  id: number
  group_id: number
  company_role_id: number
  is_working_group: boolean
}

export default function CompanyGroupsPage() {
  const params = useParams()
  const router = useRouter()
  const companyBotId = parseInt(params.id as string)

  const [company, setCompany] = useState<CompanyBot | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [roles, setRoles] = useState<CompanyRole[]>([])
  const [mappings, setMappings] = useState<Record<number, GroupRoleMapping>>({})
  const [loading, setLoading] = useState(true)
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    company_role_id: '',
    is_working_group: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [companyBotId])

  useEffect(() => {
    console.log('[GroupsPage] selectedGroup изменился:', selectedGroup)
  }, [selectedGroup])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [companyData, rolesData, groupsData, companyMappingsData, allMappingsData] = await Promise.all([
        adminApi.getCompany(companyBotId),
        adminApi.getCompanyRoles(companyBotId),
        adminApi.getGroups(),
        adminApi.getCompanyGroupMappings(companyBotId),
        adminApi.getAllGroupMappings(), // Загружаем все привязки для проверки
      ])
      
      console.log('[GroupsPage] Загруженные данные:')
      console.log('[GroupsPage] companyData:', companyData)
      console.log('[GroupsPage] rolesData:', rolesData)
      console.log('[GroupsPage] groupsData:', groupsData)
      console.log('[GroupsPage] companyMappingsData:', companyMappingsData)
      console.log('[GroupsPage] allMappingsData:', allMappingsData)
      
      setCompany(companyData)
      setRoles(rolesData)
      
      // Преобразуем массив mappings текущей компании в объект для быстрого доступа
      const mappingsMap: Record<number, GroupRoleMapping> = {}
      for (const mapping of companyMappingsData) {
        mappingsMap[mapping.group_id] = mapping
      }
      setMappings(mappingsMap)
      
      // Создаем Set всех привязанных групп (для всех компаний)
      const allMappedGroupIds = new Set(allMappingsData.map((m: GroupRoleMapping) => m.group_id))
      
      // Получаем ID ролей текущей компании
      const companyRoleIds = new Set(rolesData.map((r: CompanyRole) => r.id))
      
      // Нормализуем группы: приводим chat_id к group_id для единообразия
      const normalizedGroups = groupsData.map((g: any) => {
        const groupId = g.group_id || g.chat_id || g.id
        return {
          ...g,
          group_id: groupId,  // Убеждаемся, что group_id всегда есть
        }
      })
      
      const filteredGroups = normalizedGroups.filter((g: Group) => {
        const groupId = g.group_id!
        const mapping = mappingsMap[groupId]
        
        // Если группа привязана к роли текущей компании - показываем
        if (mapping && companyRoleIds.has(mapping.company_role_id)) {
          return true
        }
        
        // Если группа не привязана ни к какой компании - показываем (чтобы можно было привязать)
        if (!allMappedGroupIds.has(groupId)) {
          return true
        }
        
        // Если группа привязана к другой компании - не показываем
        return false
      })
      
      console.log('[GroupsPage] Нормализованные группы:', normalizedGroups)
      console.log('[GroupsPage] Отфильтрованные группы для компании:', filteredGroups)
      console.log('[GroupsPage] Все привязанные группы (все компании):', Array.from(allMappedGroupIds))
      
      setGroups(filteredGroups)
    } catch (err) {
      console.error('[GroupsPage] Ошибка при загрузке данных:', err)
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[GroupsPage] handleAssignRole вызван, selectedGroup:', selectedGroup)
    console.log('[GroupsPage] formData:', formData)
    
    if (!selectedGroup) {
      console.error('[GroupsPage] selectedGroup не установлен!')
      setError('Группа не выбрана')
      return
    }

    if (!formData.company_role_id) {
      console.error('[GroupsPage] Роль не выбрана!')
      setError('Пожалуйста, выберите роль')
      return
    }

    setError(null)
    setSuccess(null)

    try {
      const existingMapping = mappings[selectedGroup]
      const payload: any = {
        group_id: selectedGroup,
        company_role_id: parseInt(formData.company_role_id),
        is_working_group: formData.is_working_group,
      }

      console.log('[GroupsPage] Отправка payload:', payload)
      console.log('[GroupsPage] Существующая привязка:', existingMapping)

      if (existingMapping) {
        console.log('[GroupsPage] Обновление существующей привязки:', existingMapping.id)
        await adminApi.updateGroupRoleMapping(existingMapping.id, payload)
        setSuccess('Привязка роли успешно обновлена!')
      } else {
        console.log('[GroupsPage] Создание новой привязки')
        await adminApi.createGroupRoleMapping(payload)
        setSuccess('Роль успешно привязана к группе!')
      }

      await fetchData()
      setSelectedGroup(null)
      setFormData({
        company_role_id: '',
        is_working_group: true,
      })
    } catch (err) {
      console.error('[GroupsPage] Ошибка при привязке роли:', err)
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при привязке роли'
      setError(errorMessage)
    }
  }

  const handleRemoveMapping = async (groupId: number) => {
    if (!confirm('Вы уверены, что хотите удалить привязку роли к этой группе?')) {
      return
    }

    try {
      const mapping = mappings[groupId]
      if (mapping) {
        await adminApi.deleteGroupRoleMapping(mapping.id)
        setSuccess('Привязка роли успешно удалена!')
        await fetchData()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении привязки')
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Загрузка...
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
        <div>
          <button
            onClick={() => router.push('/admin/companies')}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--button-secondary-bg)',
              color: 'var(--button-secondary-text)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '8px',
            }}
          >
            ← Назад к компаниям
          </button>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: 'var(--text-color)',
          }}>
            Группы: {company?.company_name || `Компания #${companyBotId}`}
          </h1>
        </div>
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

      {groups.length === 0 ? (
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
            Группы не найдены.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px',
        }}>
          {groups.map((group) => {
            const groupId = group.group_id
            if (!groupId) {
              console.error('[GroupsPage] Группа без group_id:', group)
              return null
            }
            const mapping = mappings[groupId]
            const role = mapping ? roles.find((r: CompanyRole) => r.id === mapping.company_role_id) : null

            return (
              <div
                key={groupId}
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
                      {group.title}
                    </h3>
                    <p style={{
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      marginBottom: '4px',
                    }}>
                      ID: {groupId}
                    </p>
                    {group.group_type && (
                      <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}>
                        Тип: {group.group_type}
                      </p>
                    )}
                  </div>
                  {role && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: role.color || 'var(--primary-color)',
                      color: 'white',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}>
                      {role.icon && <span>{role.icon}</span>}
                      <span>{role.role_name}</span>
                    </div>
                  )}
                </div>

                {mapping && (
                  <div style={{
                    padding: '12px',
                    backgroundColor: 'var(--background-color)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px',
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text-color)',
                      }}>
                        Тип группы:
                      </span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        backgroundColor: mapping.is_working_group
                          ? 'var(--success-background)'
                          : 'var(--button-secondary-bg)',
                        color: mapping.is_working_group
                          ? 'var(--success-color)'
                          : 'var(--button-secondary-text)',
                      }}>
                        {mapping.is_working_group ? 'Рабочая группа' : 'Только уведомления'}
                      </span>
                    </div>
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  gap: '8px',
                }}>
                  <button
                    onClick={() => {
                      console.log('[GroupsPage] Клик по кнопке привязки роли для группы')
                      console.log('[GroupsPage] group объект:', group)
                      console.log('[GroupsPage] groupId:', groupId)
                      
                      if (!groupId) {
                        console.error('[GroupsPage] groupId не определен!', group)
                        setError('Ошибка: ID группы не определен')
                        return
                      }
                      
                      setSelectedGroup(groupId)
                      if (mapping) {
                        console.log('[GroupsPage] Существующая привязка:', mapping)
                        setFormData({
                          company_role_id: mapping.company_role_id.toString(),
                          is_working_group: mapping.is_working_group,
                        })
                      } else {
                        console.log('[GroupsPage] Новая привязка, сброс формы')
                        setFormData({
                          company_role_id: '',
                          is_working_group: true,
                        })
                      }
                    }}
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
                    {mapping ? 'Изменить роль' : 'Привязать роль'}
                  </button>
                  {mapping && (
                    <button
                      onClick={() => handleRemoveMapping(groupId)}
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
                      Удалить привязку
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/admin/companies/${companyBotId}/groups/${groupId}/notifications`)}
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
                    Уведомления
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Модальное окно для привязки роли */}
      {selectedGroup !== null && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}
        onClick={() => {
          console.log('[GroupsPage] Клик по фону модального окна, закрытие')
          setSelectedGroup(null)
        }}
        >
          <div style={{
            backgroundColor: 'var(--card-background)',
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid var(--border-color)`,
            maxWidth: '500px',
            width: '90%',
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '20px',
              color: 'var(--text-color)',
            }}>
              Привязать роль к группе
            </h2>
            
            {error && (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--error-background)',
                color: 'var(--error-color)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
              }}>
                {error}
              </div>
            )}
            
            {success && (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--success-background)',
                color: 'var(--success-color)',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px',
              }}>
                {success}
              </div>
            )}
            
            <form onSubmit={handleAssignRole}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-color)',
                }}>
                  Роль *
                </label>
                <select
                  value={formData.company_role_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, company_role_id: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '8px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-color)',
                  }}
                >
                  <option value="">Выберите роль</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.icon} {role.role_name}
                    </option>
                  ))}
                </select>
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
                    checked={formData.is_working_group}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_working_group: e.target.checked }))}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                    }}
                  />
                  Рабочая группа (бот работает в этой группе)
                </label>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginTop: '4px',
                  marginLeft: '26px',
                }}>
                  Если выключено, группа будет только получать уведомления, но бот не будет обрабатывать команды
                </p>
              </div>

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
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedGroup(null)}
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
        </div>
      )}
    </div>
  )
}

