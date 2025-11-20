// Утилита для работы с API админ-панели
// Используем Next.js API route для проксирования запросов с токеном из httpOnly cookie

// Флаг для предотвращения множественных одновременных refresh запросов
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

// Функция для обновления токена
async function refreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    await refreshPromise
    return true
  }

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/admin/refresh', {
        method: 'POST',
      })

      if (!response.ok) {
        // Если refresh не удался, возвращаем false
        return false
      }
      return true
    } catch (error) {
      console.error('[Admin API] Refresh token error:', error)
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return await refreshPromise
}

// Базовый fetch с обработкой ошибок через Next.js API proxy
async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  retryOn401: boolean = true
): Promise<Response> {
  // Используем Next.js API route для проксирования
  const proxyUrl = `/api/admin/proxy?path=${encodeURIComponent(endpoint)}`
  
  const response = await fetch(proxyUrl, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body,
  })

  // Если получили 401 и это не повторная попытка, пробуем обновить токен
  if (!response.ok && response.status === 401 && retryOn401) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    
    // Если это ошибка "Token expired" или "Unauthorized", пробуем refresh
    if (errorData.error === 'Unauthorized' || errorData.detail === 'Token expired' || errorData.detail === 'Not authenticated' || errorData.detail === 'Token expired') {
      try {
        const refreshed = await refreshToken()
        if (refreshed) {
          // Повторяем запрос после успешного refresh
          return apiFetch(endpoint, options, false) // false чтобы не зациклиться
        } else {
          // Если refresh не удался, перенаправляем на логин только один раз
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin/login')) {
            window.location.href = '/admin/login'
          }
          throw new Error('Token expired and refresh failed')
        }
      } catch (refreshError) {
        // Если refresh не удался, выбрасываем ошибку
        throw new Error(errorData.detail || errorData.error || 'Token expired')
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`)
  }

  return response
}

// API методы
export const adminApi = {
  // Компании
  async getCompanies() {
    const response = await apiFetch('/v1/company-bots')
    return response.json()
  },

  async getCompany(id: number) {
    const response = await apiFetch(`/v1/company-bots/${id}`)
    return response.json()
  },

  async createCompany(data: any) {
    const response = await apiFetch('/v1/company-bots', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async updateCompany(id: number, data: any) {
    const response = await apiFetch(`/v1/company-bots/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteCompany(id: number) {
    await apiFetch(`/v1/company-bots/${id}`, {
      method: 'DELETE',
    })
  },

  async verifyBotToken(botToken: string) {
    const response = await apiFetch('/v1/company-bots/verify-token', {
      method: 'POST',
      body: JSON.stringify({ bot_token: botToken }),
    })
    return response.json()
  },

  // Текущий админ
  async getCurrentAdmin() {
    const response = await apiFetch('/v1/admin/auth/me')
    return response.json()
  },

  // Роли компаний
  async getCompanyRoles(companyBotId: number) {
    const response = await apiFetch(`/v1/company-roles/company/${companyBotId}`)
    return response.json()
  },

  async getCompanyRole(roleId: number) {
    const response = await apiFetch(`/v1/company-roles/${roleId}`)
    return response.json()
  },

  async createCompanyRole(data: any) {
    const response = await apiFetch('/v1/company-roles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async updateCompanyRole(roleId: number, data: any) {
    const response = await apiFetch(`/v1/company-roles/${roleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteCompanyRole(roleId: number) {
    await apiFetch(`/v1/company-roles/${roleId}`, {
      method: 'DELETE',
    })
  },

  // Функции бота
  async getBotFeatures(activeOnly: boolean = false) {
    const response = await apiFetch(`/v1/bot-features?active_only=${activeOnly}`)
    return response.json()
  },

  async getBotFeature(featureId: number) {
    const response = await apiFetch(`/v1/bot-features/${featureId}`)
    return response.json()
  },

  // Привязки функций к ролям
  async getRoleFeatures(roleId: number) {
    const response = await apiFetch(`/v1/role-feature-mappings/role/${roleId}`)
    return response.json()
  },

  async createRoleFeatureMapping(data: any) {
    const response = await apiFetch('/v1/role-feature-mappings', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async updateRoleFeatureMapping(mappingId: number, data: any) {
    const response = await apiFetch(`/v1/role-feature-mappings/${mappingId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteRoleFeatureMapping(mappingId: number) {
    await apiFetch(`/v1/role-feature-mappings/${mappingId}`, {
      method: 'DELETE',
    })
  },

  // Функции группы
  async getGroupFeatures(groupId: number) {
    const response = await apiFetch(`/v1/group-role-mappings/group/${groupId}/features`)
    return response.json()
  },

  // Привязки групп к ролям
  async getAllGroupMappings() {
    const response = await apiFetch(`/v1/group-role-mappings`)
    return response.json()
  },

  async getCompanyGroupMappings(companyBotId: number) {
    const response = await apiFetch(`/v1/group-role-mappings/company/${companyBotId}`)
    return response.json()
  },

  async getGroupRoleMapping(groupId: number) {
    const response = await apiFetch(`/v1/group-role-mappings/group/${groupId}`)
    return response.json()
  },

  async createGroupRoleMapping(data: any) {
    const response = await apiFetch('/v1/group-role-mappings', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async updateGroupRoleMapping(mappingId: number, data: any) {
    const response = await apiFetch(`/v1/group-role-mappings/${mappingId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteGroupRoleMapping(mappingId: number) {
    await apiFetch(`/v1/group-role-mappings/${mappingId}`, {
      method: 'DELETE',
    })
  },

  // Уведомления для функций
  async getWorkingGroupNotifications(workingGroupId: number) {
    const response = await apiFetch(`/v1/group-feature-notifications/working-group/${workingGroupId}`)
    return response.json()
  },

  async createGroupFeatureNotification(data: any) {
    const response = await apiFetch('/v1/group-feature-notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async updateGroupFeatureNotification(notificationId: number, data: any) {
    const response = await apiFetch(`/v1/group-feature-notifications/${notificationId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteGroupFeatureNotification(notificationId: number) {
    await apiFetch(`/v1/group-feature-notifications/${notificationId}`, {
      method: 'DELETE',
    })
  },

  // Группы (используем существующий endpoint)
  async getGroups(groupType?: string) {
    const url = groupType 
      ? `/v1/groups?group_type=${groupType}`
      : '/v1/groups'
    const response = await apiFetch(url)
    return response.json()
  },

  // Администраторы
  async getAdminUsers(companyBotId?: number) {
    const url = companyBotId
      ? `/v1/admin/users?company_bot_id=${companyBotId}`
      : '/v1/admin/users'
    const response = await apiFetch(url)
    return response.json()
  },

  async getAdminUser(userId: number) {
    const response = await apiFetch(`/v1/admin/users/${userId}`)
    return response.json()
  },

  async createAdminUser(data: any) {
    const response = await apiFetch('/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async updateAdminUser(userId: number, data: any) {
    const response = await apiFetch(`/v1/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteAdminUser(userId: number) {
    await apiFetch(`/v1/admin/users/${userId}`, {
      method: 'DELETE',
    })
  },

  // Участники группы
  async getGroupMembers(groupTelegramId: number) {
    const response = await apiFetch(`/v1/groups/${groupTelegramId}/members`)
    return response.json()
  },

  // Делегаты доступа к функционалу
  async getFeatureAccessDelegates(mappingId: number, groupId: number) {
    const response = await apiFetch(`/v1/feature-access/delegates/mapping/${mappingId}/group/${groupId}`)
    return response.json()
  },

  async createFeatureAccessDelegate(data: any) {
    const response = await apiFetch('/v1/feature-access/delegates', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return response.json()
  },

  async deleteFeatureAccessDelegate(delegateId: number) {
    await apiFetch(`/v1/feature-access/delegates/${delegateId}`, {
      method: 'DELETE',
    })
  },
}

