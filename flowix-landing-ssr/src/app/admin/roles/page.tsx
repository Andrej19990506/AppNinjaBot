'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface CompanyBot {
  id: number
  company_name: string | null
}

interface CompanyRole {
  id: number
  company_bot_id: number
  role_name: string
  role_code: string
  description: string | null
  icon: string | null
  color: string | null
  is_active: boolean
}

export default function RolesPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<CompanyBot[]>([])
  const [roles, setRoles] = useState<CompanyRole[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      fetchRoles(selectedCompany)
    } else {
      fetchAllRoles()
    }
  }, [selectedCompany])

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

  const fetchRoles = async (companyBotId: number) => {
    try {
      const rolesData = await adminApi.getCompanyRoles(companyBotId)
      setRoles(rolesData)
    } catch (err) {
      console.error('Ошибка при загрузке ролей:', err)
      setRoles([])
    }
  }

  const fetchAllRoles = async () => {
    try {
      const allRoles: CompanyRole[] = []
      for (const company of companies) {
        try {
          const rolesData = await adminApi.getCompanyRoles(company.id)
          allRoles.push(...rolesData)
        } catch (err) {
          console.error(`Ошибка при загрузке ролей для компании ${company.id}:`, err)
        }
      }
      setRoles(allRoles)
    } catch (err) {
      console.error('Ошибка при загрузке всех ролей:', err)
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
          Роли
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
            marginBottom: '16px',
          }}>
            Роли не найдены.
          </p>
          {selectedCompany && (
            <button
              onClick={() => router.push(`/admin/companies/${selectedCompany}/roles`)}
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
              Создать роль
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px',
        }}>
          {roles.map((role) => {
            const company = companies.find(c => c.id === role.company_bot_id)
            return (
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
                        marginBottom: '4px',
                      }}>
                        Код: <code style={{
                          backgroundColor: 'var(--background-color)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}>{role.role_code}</code>
                      </p>
                      {company && (
                        <p style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                        }}>
                          Компания: {company.company_name || `#${company.id}`}
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
                {role.description && (
                  <p style={{
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    marginBottom: '16px',
                  }}>
                    {role.description}
                  </p>
                )}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                }}>
                  <button
                    onClick={() => router.push(`/admin/companies/${role.company_bot_id}/roles`)}
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

