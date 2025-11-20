'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface BotFeature {
  id: number
  feature_code: string
  feature_name: string
  description: string | null
  icon: string | null
  is_active: boolean
}

export default function FeaturesPage() {
  const [features, setFeatures] = useState<BotFeature[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFeatures()
  }, [])

  const fetchFeatures = async () => {
    try {
      setLoading(true)
      const featuresData = await adminApi.getBotFeatures(false) // Все функции, включая неактивные
      setFeatures(featuresData)
    } catch (err) {
      console.error('Ошибка при загрузке функций:', err)
    } finally {
      setLoading(false)
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
      <h1 style={{
        fontSize: '28px',
        fontWeight: 'bold',
        marginBottom: '24px',
        color: 'var(--text-color)',
      }}>
        Функции бота
      </h1>

      {features.length === 0 ? (
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
            Функции не найдены.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px',
        }}>
          {features.map((feature) => (
            <div
              key={feature.id}
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
                  {feature.icon && (
                    <span style={{ fontSize: '24px' }}>{feature.icon}</span>
                  )}
                  <div>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      marginBottom: '4px',
                      color: 'var(--text-color)',
                    }}>
                      {feature.feature_name}
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
                      }}>{feature.feature_code}</code>
                    </p>
                  </div>
                </div>
                <div style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: feature.is_active
                    ? 'var(--success-background)'
                    : 'var(--error-background)',
                  color: feature.is_active
                    ? 'var(--success-color)'
                    : 'var(--error-color)',
                }}>
                  {feature.is_active ? 'Активна' : 'Неактивна'}
                </div>
              </div>
              {feature.description && (
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                }}>
                  {feature.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

