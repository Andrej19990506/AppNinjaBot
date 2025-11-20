'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import '@/styles/admin-variables.css'

interface Group {
  group_id: number
  title: string
}

interface BotFeature {
  id: number
  feature_code: string
  feature_name: string
  description: string | null
  icon: string | null
}

interface GroupFeatureNotification {
  id: number
  bot_feature_id: number
  working_group_id: number
  notification_group_id: number
  notification_type: string
}

interface NotificationGroup {
  group_id: number
  title: string
}

export default function GroupNotificationsPage() {
  const params = useParams()
  const router = useRouter()
  const companyBotId = parseInt(params.id as string)
  const groupId = parseInt(params.groupId as string)

  const [workingGroup, setWorkingGroup] = useState<Group | null>(null)
  const [botFeatures, setBotFeatures] = useState<BotFeature[]>([])
  const [notificationGroups, setNotificationGroups] = useState<NotificationGroup[]>([])
  const [notifications, setNotifications] = useState<GroupFeatureNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFeature, setSelectedFeature] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    bot_feature_id: '',
    notification_group_id: '',
    notification_type: 'excel',
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [groupsData, featuresData, notificationsData] = await Promise.all([
        adminApi.getGroups(),
        adminApi.getBotFeatures(true),
        adminApi.getWorkingGroupNotifications(groupId),
      ])
      
      // Находим рабочую группу
      const group = groupsData.find((g: Group) => g.group_id === groupId)
      setWorkingGroup(group || null)
      
      // Получаем все группы для выбора
      setNotificationGroups(groupsData)
      setBotFeatures(featuresData)
      setNotifications(notificationsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      await adminApi.createGroupFeatureNotification({
        bot_feature_id: parseInt(formData.bot_feature_id),
        working_group_id: groupId,
        notification_group_id: parseInt(formData.notification_group_id),
        notification_type: formData.notification_type,
      })
      setSuccess('Настройка уведомлений успешно создана!')
      await fetchData()
      setSelectedFeature(null)
      setFormData({
        bot_feature_id: '',
        notification_group_id: '',
        notification_type: 'excel',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании настройки уведомлений')
    }
  }

  const handleDeleteNotification = async (notificationId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту настройку уведомлений?')) {
      return
    }

    try {
      await adminApi.deleteGroupFeatureNotification(notificationId)
      setSuccess('Настройка уведомлений успешно удалена!')
      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении настройки')
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
            onClick={() => router.push(`/admin/companies/${companyBotId}/groups`)}
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
            ← Назад к группам
          </button>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: 'var(--text-color)',
          }}>
            Уведомления: {workingGroup?.title || `Группа #${groupId}`}
          </h1>
        </div>
        <button
          onClick={() => setSelectedFeature(0)}
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
          + Добавить уведомление
        </button>
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

      {notifications.length === 0 ? (
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
            Настройки уведомлений не найдены. Создайте первую настройку.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: '16px',
        }}>
          {notifications.map((notification) => {
            const feature = botFeatures.find(f => f.id === notification.bot_feature_id)
            const notifGroup = notificationGroups.find(g => g.group_id === notification.notification_group_id)

            return (
              <div
                key={notification.id}
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
                    {feature?.icon && (
                      <span style={{ fontSize: '24px' }}>{feature.icon}</span>
                    )}
                    <div>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        marginBottom: '4px',
                        color: 'var(--text-color)',
                      }}>
                        {feature?.feature_name || 'Неизвестная функция'}
                      </h3>
                      <p style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginBottom: '8px',
                      }}>
                        Отправка в группу: {notifGroup?.title || `ID: ${notification.notification_group_id}`}
                      </p>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: 'var(--text-secondary)',
                        }}>
                          Тип уведомления:
                        </span>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: 'var(--button-secondary-bg)',
                          color: 'var(--button-secondary-text)',
                        }}>
                          {notification.notification_type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteNotification(notification.id)}
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
            )
          })}
        </div>
      )}

      {/* Модальное окно для создания уведомления */}
      {selectedFeature !== null && (
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
        onClick={() => setSelectedFeature(null)}
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
              Добавить настройку уведомлений
            </h2>
            <form onSubmit={handleCreateNotification}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-color)',
                }}>
                  Функция бота *
                </label>
                <select
                  value={formData.bot_feature_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, bot_feature_id: e.target.value }))}
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
                  <option value="">Выберите функцию</option>
                  {botFeatures.map((feature) => (
                    <option key={feature.id} value={feature.id}>
                      {feature.icon} {feature.feature_name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-color)',
                }}>
                  Группа для уведомлений *
                </label>
                <select
                  value={formData.notification_group_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, notification_group_id: e.target.value }))}
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
                  <option value="">Выберите группу</option>
                  {notificationGroups
                    .filter(g => g.group_id !== groupId)
                    .map((group) => (
                      <option key={group.group_id} value={group.group_id}>
                        {group.title}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-color)',
                }}>
                  Тип уведомления *
                </label>
                <select
                  value={formData.notification_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, notification_type: e.target.value }))}
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
                  <option value="excel">Excel файл</option>
                  <option value="message">Сообщение</option>
                  <option value="file">Файл</option>
                </select>
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
                  Создать
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeature(null)}
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

