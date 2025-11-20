'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface Group {
  group_id: number
  title: string
  group_type: string | null
}

interface CompanyBot {
  id: number
  company_name: string | null
}

interface GroupRoleMapping {
  id: number
  group_id: number
  company_role_id: number
  is_working_group: boolean
}

interface CompanyRole {
  id: number
  company_bot_id: number
  role_name: string
  icon: string | null
  color: string | null
}

export default function GroupsPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyBot[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [mappings, setMappings] = useState<Record<number, GroupRoleMapping>>({})
  const [roles, setRoles] = useState<Record<number, CompanyRole>>({})
  const [groupToCompanyMap, setGroupToCompanyMap] = useState<Record<number, CompanyBot>>({})
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    console.log(`[useEffect] selectedCompany изменился: ${selectedCompany}`)
    if (selectedCompany) {
      console.log(`[useEffect] Вызываем fetchCompanyData для компании ${selectedCompany}`)
      fetchCompanyData(selectedCompany)
    } else {
      if (companies.length > 0) {
        console.log(`[useEffect] Вызываем fetchAllData (все компании)`)
        fetchAllData()
      }
    }
  }, [selectedCompany, companies])

  const fetchData = async () => {
    try {
      setLoading(true)
      const companiesData = await adminApi.getCompanies()
      setCompanies(companiesData)
      if (companiesData.length > 0) {
        setSelectedCompany(companiesData[0].id)
      }
    } catch (err) {
      console.error('Ошибка при загрузке компаний:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyData = async (companyBotId: number) => {
    try {
      // Очищаем группы сразу, чтобы не показывать старые данные
      setGroups([])
      
      const [allGroupsData, mappingsData] = await Promise.all([
        adminApi.getGroups(),
        adminApi.getCompanyGroupMappings(companyBotId),
      ])
      
      console.log(`[fetchCompanyData] Компания ID: ${companyBotId}, всего групп: ${allGroupsData.length}, mappings: ${mappingsData.length}`)
      
      // Фильтруем группы: показываем только те, которые привязаны к выбранной компании
      const groupIdsForCompany = new Set(mappingsData.map((m: GroupRoleMapping) => m.group_id))
      const filteredGroups = allGroupsData.filter((g: Group) => groupIdsForCompany.has(g.group_id))
      
      console.log(`[fetchCompanyData] Отфильтровано групп: ${filteredGroups.length}`, filteredGroups.map((g: Group) => ({ id: g.group_id, title: g.title })))
      
      // Устанавливаем отфильтрованные группы
      setGroups(filteredGroups)
      
      const mappingsMap: Record<number, GroupRoleMapping> = {}
      for (const mapping of mappingsData) {
        mappingsMap[mapping.group_id] = mapping
      }
      setMappings(mappingsMap)
      
      // Загружаем роли для отображения
      const rolesData = await adminApi.getCompanyRoles(companyBotId)
      const rolesMap: Record<number, CompanyRole> = {}
      for (const role of rolesData) {
        rolesMap[role.id] = role
      }
      setRoles(rolesMap)
      
      // Очищаем groupToCompanyMap для режима выбранной компании
      setGroupToCompanyMap({})
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err)
    }
  }

  const fetchAllData = async () => {
    try {
      // Очищаем группы сразу, чтобы не показывать старые данные
      setGroups([])
      
      const groupsData = await adminApi.getGroups()
      
      // Загружаем mappings для всех компаний
      const allMappings: Record<number, GroupRoleMapping> = {}
      const allRoles: Record<number, CompanyRole> = {}
      const groupToCompanyMap: Record<number, CompanyBot> = {} // Маппинг group_id -> компания
      
      for (const company of companies) {
        try {
          const [mappingsData, rolesData] = await Promise.all([
            adminApi.getCompanyGroupMappings(company.id),
            adminApi.getCompanyRoles(company.id),
          ])
          
          for (const mapping of mappingsData) {
            allMappings[mapping.group_id] = mapping
            // Сохраняем информацию о компании для группы
            // Если группа уже привязана к другой компании, не перезаписываем
            if (!groupToCompanyMap[mapping.group_id]) {
              groupToCompanyMap[mapping.group_id] = company
            }
          }
          
          for (const role of rolesData) {
            allRoles[role.id] = role
          }
        } catch (err) {
          console.error(`Ошибка при загрузке данных для компании ${company.id}:`, err)
        }
      }
      
      // Фильтруем группы: показываем только те, которые привязаны к какой-либо компании
      const groupIdsWithMappings = new Set(Object.keys(allMappings).map(Number))
      const filteredGroups = groupsData.filter((g: Group) => groupIdsWithMappings.has(g.group_id))
      setGroups(filteredGroups)
      
      setMappings(allMappings)
      setRoles(allRoles)
      
      // Сохраняем маппинг групп к компаниям в state
      setGroupToCompanyMap(groupToCompanyMap)
    } catch (err) {
      console.error('Ошибка при загрузке всех данных:', err)
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
        <h1 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: 'var(--text-color)',
        }}>
          Группы
        </h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={selectedCompany || ''}
            onChange={(e) => setSelectedCompany(e.target.value ? parseInt(e.target.value) : null)}
            style={{
              padding: '10px 16px',
              fontSize: '14px',
              border: `1px solid var(--border-color)`,
              borderRadius: '8px',
              backgroundColor: 'var(--background-color)',
              color: 'var(--text-color)',
            }}
          >
            <option value="">Все компании</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.company_name || `Компания #${company.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            const mapping = mappings[group.group_id]
            const role = mapping ? roles[mapping.company_role_id] : null
            // Определяем компанию для группы
            let company: CompanyBot | null = null
            if (selectedCompany) {
              // Если выбрана конкретная компания, используем её
              company = companies.find(c => c.id === selectedCompany) || null
            } else {
              // Если "Все компании", ищем через role
              if (role) {
                company = companies.find(c => c.id === role.company_bot_id) || null
              } else {
                // Пробуем через groupToCompanyMap
                company = groupToCompanyMap[group.group_id] || null
              }
            }

            return (
              <div
                key={group.group_id}
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
                    {company && (
                      <p style={{
                        fontSize: '14px',
                        color: 'var(--primary-color)',
                        fontWeight: 500,
                        marginBottom: '4px',
                      }}>
                        Компания: {company.company_name || `Компания #${company.id}`}
                      </p>
                    )}
                    <p style={{
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      marginBottom: '4px',
                    }}>
                      ID: {group.group_id}
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
                  {mapping && (
                    <button
                      onClick={() => {
                        const company = companies.find(c => {
                          const role = roles[mapping.company_role_id]
                          return role && c.id === role.company_bot_id
                        })
                        if (company) {
                          router.push(`/admin/companies/${company.id}/groups`)
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
                      Управление
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

