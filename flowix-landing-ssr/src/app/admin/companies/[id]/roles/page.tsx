'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface CompanyRole {
  id: number
  company_bot_id: number
  role_name: string
  role_code: string
  description: string | null
  icon: string | null
  color: string | null
  display_order: number
  is_active: boolean
  permissions: string | null
  created_at: string
  updated_at: string
}

interface CompanyBot {
  id: number
  company_name: string | null
}

interface BotFeature {
  id: number
  feature_code: string
  feature_name: string
  description: string | null
  icon: string | null
  is_active: boolean
}

interface RoleFeatureMapping {
  id: number
  company_role_id: number
  bot_feature_id: number
  is_enabled: boolean
  access_type: 'open' | 'restricted'
}

export default function CompanyRolesPage() {
  const params = useParams()
  const router = useRouter()
  const companyBotId = parseInt(params.id as string)

  const [company, setCompany] = useState<CompanyBot | null>(null)
  const [roles, setRoles] = useState<CompanyRole[]>([])
  const [botFeatures, setBotFeatures] = useState<BotFeature[]>([])
  const [roleFeatures, setRoleFeatures] = useState<Record<number, RoleFeatureMapping[]>>({})
  const [selectedRoleForFeatures, setSelectedRoleForFeatures] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [groupsForRole, setGroupsForRole] = useState<Record<number, any[]>>({}) // Группы для каждой роли
  const [groupMembers, setGroupMembers] = useState<Record<number, any[]>>({}) // Участники для каждой группы
  const [delegates, setDelegates] = useState<Record<string, any[]>>({}) // Делегаты: ключ = "mappingId_groupId"
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingRole, setEditingRole] = useState<CompanyRole | null>(null)
  const [formData, setFormData] = useState({
    role_name: '',
    role_code: '',
    description: '',
    icon: '',
    color: '#FF6B35',
    display_order: 0,
    is_active: true,
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [companyBotId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [companyData, rolesData, featuresData] = await Promise.all([
        adminApi.getCompany(companyBotId),
        adminApi.getCompanyRoles(companyBotId),
        adminApi.getBotFeatures(true), // Только активные функции
      ])
      setCompany(companyData)
      setRoles(rolesData)
      setBotFeatures(featuresData)
      
      // Загружаем функции для каждой роли
      const featuresMap: Record<number, RoleFeatureMapping[]> = {}
      for (const role of rolesData) {
        try {
          const roleFeaturesData = await adminApi.getRoleFeatures(role.id)
          featuresMap[role.id] = roleFeaturesData
        } catch (err) {
          featuresMap[role.id] = []
        }
      }
      setRoleFeatures(featuresMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoleFeatures = async (roleId: number) => {
    try {
      const features = await adminApi.getRoleFeatures(roleId)
      setRoleFeatures(prev => ({ ...prev, [roleId]: features }))
      
      // Загружаем группы, связанные с этой ролью
      const mappings = await adminApi.getCompanyGroupMappings(companyBotId)
      const groupsForThisRole = mappings
        .filter((m: any) => m.company_role_id === roleId)
        .map((m: any) => ({ group_id: m.group_id, mapping: m }))
      
      // Загружаем все группы для получения названий
      const allGroups = await adminApi.getGroups()
      const groupsWithNames = groupsForThisRole.map((g: any) => {
        const group = allGroups.find((ag: any) => (ag.group_id || ag.chat_id || ag.id) === g.group_id)
        return {
          group_id: g.group_id,
          title: group?.title || `Группа ${g.group_id}`,
          mapping: g.mapping,
        }
      })
      
      setGroupsForRole(prev => ({ ...prev, [roleId]: groupsWithNames }))
      
      // Загружаем делегатов для всех restricted features этой роли
      const restrictedMappings = features.filter((f: RoleFeatureMapping) => f.access_type === 'restricted')
      for (const mapping of restrictedMappings) {
        for (const groupInfo of groupsWithNames) {
          try {
            const delegatesData = await adminApi.getFeatureAccessDelegates(mapping.id, groupInfo.group_id)
            const key = `${mapping.id}_${groupInfo.group_id}`
            setDelegates(prev => ({ ...prev, [key]: delegatesData }))
          } catch (err) {
            console.error(`Ошибка при загрузке делегатов для mapping ${mapping.id}, group ${groupInfo.group_id}:`, err)
          }
        }
      }
    } catch (err) {
      console.error('Ошибка при загрузке функций роли:', err)
    }
  }

  const fetchGroupMembers = async (groupTelegramId: number) => {
    if (groupMembers[groupTelegramId]) {
      return // Уже загружены
    }
    try {
      const members = await adminApi.getGroupMembers(groupTelegramId)
      setGroupMembers(prev => ({ ...prev, [groupTelegramId]: members }))
    } catch (err) {
      console.error(`Ошибка при загрузке участников группы ${groupTelegramId}:`, err)
    }
  }

  const handleAddDelegate = async (mappingId: number, groupId: number, userId: number) => {
    try {
      await adminApi.createFeatureAccessDelegate({
        role_feature_mapping_id: mappingId,
        group_id: groupId,
        delegate_user_id: userId,
      })
      await fetchRoleFeatures(selectedRoleForFeatures!)
      setSuccess('Делегат успешно добавлен!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при добавлении делегата')
    }
  }

  const handleRemoveDelegate = async (delegateId: number) => {
    try {
      await adminApi.deleteFeatureAccessDelegate(delegateId)
      await fetchRoleFeatures(selectedRoleForFeatures!)
      setSuccess('Делегат успешно удален!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении делегата')
    }
  }

  const toggleRoleFeature = async (roleId: number, featureId: number, isEnabled: boolean, accessType: 'open' | 'restricted' = 'open') => {
    try {
      const existingMapping = roleFeatures[roleId]?.find(m => m.bot_feature_id === featureId)
      
      if (existingMapping) {
        // Обновляем существующую привязку
        await adminApi.updateRoleFeatureMapping(existingMapping.id, { 
          is_enabled: isEnabled,
          access_type: accessType,
        })
      } else {
        // Создаем новую привязку
        await adminApi.createRoleFeatureMapping({
          company_role_id: roleId,
          bot_feature_id: featureId,
          is_enabled: isEnabled,
          access_type: accessType,
        })
      }
      
      // Обновляем локальное состояние
      await fetchRoleFeatures(roleId)
      setSuccess('Функция успешно обновлена!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении функции')
    }
  }

  const updateAccessType = async (roleId: number, featureId: number, accessType: 'open' | 'restricted') => {
    try {
      const existingMapping = roleFeatures[roleId]?.find(m => m.bot_feature_id === featureId)
      
      if (existingMapping) {
        await adminApi.updateRoleFeatureMapping(existingMapping.id, { 
          access_type: accessType,
        })
        await fetchRoleFeatures(roleId)
        setSuccess('Тип доступа успешно обновлен!')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении типа доступа')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const payload: any = {
        company_bot_id: companyBotId,
        role_name: formData.role_name,
        role_code: formData.role_code,
        description: formData.description || null,
        icon: formData.icon || null,
        color: formData.color || null,
        display_order: formData.display_order,
        is_active: formData.is_active,
      }

      if (editingRole) {
        const updatedRole = await adminApi.updateCompanyRole(editingRole.id, payload)
        setRoles(roles.map(r => r.id === editingRole.id ? updatedRole : r))
        setSuccess('Роль успешно обновлена!')
        setEditingRole(null)
        setShowCreateForm(false)
      } else {
        const newRole = await adminApi.createCompanyRole(payload)
        setRoles([...roles, newRole])
        setSuccess('Роль успешно создана!')
        setShowCreateForm(false)
      }
      setFormData({
        role_name: '',
        role_code: '',
        description: '',
        icon: '',
        color: '#FF6B35',
        display_order: 0,
        is_active: true,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении роли')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) || 0 : value,
    }))
  }

  const handleEdit = (role: CompanyRole) => {
    setEditingRole(role)
    setShowCreateForm(true)
    setFormData({
      role_name: role.role_name,
      role_code: role.role_code,
      description: role.description || '',
      icon: role.icon || '',
      color: role.color || '#FF6B35',
      display_order: role.display_order,
      is_active: role.is_active,
    })
    setError(null)
    setSuccess(null)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту роль?')) {
      return
    }

    try {
      await adminApi.deleteCompanyRole(id)
      setRoles(roles.filter(r => r.id !== id))
      setSuccess('Роль успешно удалена!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении роли')
    }
  }

  const handleCancel = () => {
    setShowCreateForm(false)
    setEditingRole(null)
    setFormData({
      role_name: '',
      role_code: '',
      description: '',
      icon: '',
      color: '#FF6B35',
      display_order: 0,
      is_active: true,
    })
    setError(null)
    setSuccess(null)
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
            Роли: {company?.company_name || `Компания #${companyBotId}`}
          </h1>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => {
              setShowCreateForm(true)
              setEditingRole(null)
              setFormData({
                role_name: '',
                role_code: '',
                description: '',
                icon: '',
                color: '#FF6B35',
                display_order: 0,
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
            + Создать роль
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
            {editingRole ? 'Редактировать роль' : 'Создать новую роль'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-color)',
                }}>
                  Название роли *
                </label>
                <input
                  type="text"
                  name="role_name"
                  value={formData.role_name}
                  onChange={handleInputChange}
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
                  placeholder="Повар"
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
                  Код роли * (латиница, без пробелов)
                </label>
                <input
                  type="text"
                  name="role_code"
                  value={formData.role_code}
                  onChange={handleInputChange}
                  required
                  pattern="[a-z0-9_]+"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '8px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-color)',
                  }}
                  placeholder="chef"
                />
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--text-color)',
              }}>
                Описание
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: `1px solid var(--border-color)`,
                  borderRadius: '8px',
                  backgroundColor: 'var(--background-color)',
                  color: 'var(--text-color)',
                  resize: 'vertical',
                }}
                placeholder="Описание роли..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-color)',
                }}>
                  Иконка (emoji или код)
                </label>
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
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
                  placeholder="👨‍🍳"
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
                  Цвет (hex)
                </label>
                <input
                  type="color"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '4px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '8px',
                    backgroundColor: 'var(--background-color)',
                    height: '42px',
                    cursor: 'pointer',
                  }}
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
                  Порядок отображения
                </label>
                <input
                  type="number"
                  name="display_order"
                  value={formData.display_order}
                  onChange={handleInputChange}
                  min={0}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: `1px solid var(--border-color)`,
                    borderRadius: '8px',
                    backgroundColor: 'var(--background-color)',
                    color: 'var(--text-color)',
                  }}
                />
              </div>
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
                {editingRole ? 'Сохранить' : 'Создать'}
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

      {roles.length === 0 ? (
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
            Роли не найдены. Создайте первую роль.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px',
        }}>
          {roles.map((role) => (
            <div
              key={role.id}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {role.icon && (
                    <span style={{ fontSize: '24px' }}>{role.icon}</span>
                  )}
                  <div>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: 'var(--text-color)',
                    }}>
                      {role.role_name}
                    </h3>
                    <p style={{
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                    }}>
                      Код: <code style={{
                        backgroundColor: 'var(--background-color)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}>{role.role_code}</code>
                    </p>
                    {role.description && (
                      <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginTop: '8px',
                      }}>
                        {role.description}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {role.color && (
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: role.color,
                      border: `2px solid var(--border-color)`,
                    }} />
                  )}
                  <div style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: role.is_active
                      ? 'var(--success-background)'
                      : 'var(--error-background)',
                    color: role.is_active
                      ? 'var(--success-color)'
                      : 'var(--error-color)',
                  }}>
                    {role.is_active ? 'Активна' : 'Неактивна'}
                  </div>
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
                  Порядок: {role.display_order} | Создана: {new Date(role.created_at).toLocaleString('ru-RU')}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      setSelectedRoleForFeatures(role.id)
                      if (!roleFeatures[role.id]) {
                        fetchRoleFeatures(role.id)
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
                    Функции
                  </button>
                  <button
                    onClick={() => handleEdit(role)}
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
                    onClick={() => handleDelete(role.id)}
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

      {/* Модальное окно для управления функциями роли */}
      {selectedRoleForFeatures !== null && (
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
        onClick={() => setSelectedRoleForFeatures(null)}
        >
          <div style={{
            backgroundColor: 'var(--card-background)',
            borderRadius: '12px',
            padding: '24px',
            border: `1px solid var(--border-color)`,
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h2 style={{
                fontSize: '20px',
                fontWeight: 600,
                color: 'var(--text-color)',
              }}>
                Функции роли: {roles.find(r => r.id === selectedRoleForFeatures)?.role_name}
              </h2>
              <button
                onClick={() => setSelectedRoleForFeatures(null)}
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--text-color)',
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              {botFeatures.map((feature) => {
                const mapping = roleFeatures[selectedRoleForFeatures]?.find(
                  m => m.bot_feature_id === feature.id
                )
                const isEnabled = mapping?.is_enabled || false
                const accessType = mapping?.access_type || 'open'

                return (
                  <div
                    key={feature.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: 'var(--background-color)',
                      borderRadius: '8px',
                      border: `1px solid var(--border-color)`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {feature.icon && (
                          <span style={{ fontSize: '20px' }}>{feature.icon}</span>
                        )}
                        <div>
                          <div style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--text-color)',
                          }}>
                            {feature.feature_name}
                          </div>
                          {feature.description && (
                            <div style={{
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                              marginTop: '4px',
                            }}>
                              {feature.description}
                            </div>
                          )}
                        </div>
                      </div>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => {
                            toggleRoleFeature(selectedRoleForFeatures!, feature.id, e.target.checked, accessType)
                          }}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                          }}
                        />
                        <span style={{
                          fontSize: '14px',
                          color: 'var(--text-color)',
                        }}>
                          {isEnabled ? 'Включена' : 'Выключена'}
                        </span>
                      </label>
                    </div>
                    
                    {isEnabled && (
                      <>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          paddingTop: '8px',
                          borderTop: '1px solid var(--border-color)',
                        }}>
                          <span style={{
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                          }}>
                            Тип доступа:
                          </span>
                          <select
                            value={accessType}
                            onChange={(e) => {
                              const newAccessType = e.target.value as 'open' | 'restricted'
                              updateAccessType(selectedRoleForFeatures!, feature.id, newAccessType)
                            }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--background-color)',
                              color: 'var(--text-color)',
                              fontSize: '13px',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="open">Открыт (для всех участников группы)</option>
                            <option value="restricted">Ограничен (только для уполномоченных)</option>
                          </select>
                        </div>
                        
                        {accessType === 'restricted' && mapping && (
                          <div style={{
                            paddingTop: '12px',
                            borderTop: '1px solid var(--border-color)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}>
                            <div style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-color)',
                              marginBottom: '8px',
                            }}>
                              Делегаты (могут раздавать доступ в приложении):
                            </div>
                            
                            {groupsForRole[selectedRoleForFeatures!]?.map((groupInfo: any) => {
                              const delegateKey = `${mapping.id}_${groupInfo.group_id}`
                              const currentDelegates = delegates[delegateKey] || []
                              const members = groupMembers[groupInfo.group_id] || []
                              
                              return (
                                <div
                                  key={groupInfo.group_id}
                                  style={{
                                    padding: '12px',
                                    backgroundColor: 'var(--background-color)',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--text-color)',
                                    marginBottom: '8px',
                                  }}>
                                    {groupInfo.title}
                                  </div>
                                  
                                  {currentDelegates.length > 0 && (
                                    <div style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '6px',
                                      marginBottom: '12px',
                                    }}>
                                      {currentDelegates.map((delegate: any) => {
                                        const member = members.find((m: any) => m.user_id === delegate.delegate_user_id)
                                        return (
                                          <div
                                            key={delegate.id}
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              padding: '6px 10px',
                                              backgroundColor: 'var(--background-color)',
                                              borderRadius: '4px',
                                              border: '1px solid var(--border-color)',
                                            }}
                                          >
                                            <span style={{
                                              fontSize: '12px',
                                              color: 'var(--text-color)',
                                            }}>
                                              {member?.user_name || `User ${delegate.delegate_user_id}`}
                                            </span>
                                            <button
                                              onClick={() => handleRemoveDelegate(delegate.id)}
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '11px',
                                                backgroundColor: 'var(--error-background)',
                                                color: 'var(--error-color)',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Удалить
                                            </button>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                  
                                  <select
                                    onChange={(e) => {
                                      const userId = parseInt(e.target.value)
                                      if (userId) {
                                        handleAddDelegate(mapping.id, groupInfo.group_id, userId)
                                        e.target.value = ''
                                      }
                                    }}
                                    onClick={() => {
                                      if (members.length === 0) {
                                        fetchGroupMembers(groupInfo.group_id)
                                      }
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--background-color)',
                                      color: 'var(--text-color)',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      outline: 'none',
                                    }}
                                  >
                                    <option value="">Выберите пользователя для назначения делегатом...</option>
                                    {members
                                      .filter((m: any) => !currentDelegates.some((d: any) => d.delegate_user_id === m.user_id))
                                      .map((member: any) => (
                                        <option key={member.user_id} value={member.user_id}>
                                          {member.user_name} {member.role && `(${member.role})`}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )
                            })}
                            
                            {(!groupsForRole[selectedRoleForFeatures!] || groupsForRole[selectedRoleForFeatures!].length === 0) && (
                              <div style={{
                                padding: '12px',
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                textAlign: 'center',
                                fontStyle: 'italic',
                              }}>
                                Нет групп, связанных с этой ролью. Сначала привяжите группу к роли на странице "Группы".
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

