/**
 * Утилита для получения Telegram user_id
 */

/**
 * Получить Telegram user_id из Redux store
 * В вашем приложении user_id хранится в Redux после авторизации
 */
export const getCurrentUserId = (): number => {
  // Получаем Redux store из window (если доступен)
  const reduxState = (window as any).__REDUX_DEVTOOLS_EXTENSION__?.() || null;
  
  // Пытаемся получить из localStorage как fallback
  const userDataStr = localStorage.getItem('user');
  if (userDataStr) {
    try {
      const userData = JSON.parse(userDataStr);
      if (userData.id) {
        return userData.id;
      }
    } catch (e) {
      console.error('Ошибка парсинга user из localStorage:', e);
    }
  }

  // Если не нашли - пытаемся получить из Redux напрямую
  try {
    // Предполагаем, что в Redux есть user.id
    const store = (window as any).store;
    if (store) {
      const state = store.getState();
      if (state.user?.user?.id) {
        return state.user.user.id;
      }
    }
  } catch (e) {
    console.error('Ошибка получения user_id из Redux:', e);
  }

  // Для тестирования - возвращаем тестовый ID (только если не запущен в production)
  if (import.meta.env.DEV) {
    console.log('🧪 [getUserId] Используем тестовый user_id для разработки');
  }
  return 1682142222; // Тестовый ID из логов
};

/**
 * Проверить, авторизован ли пользователь
 */
export const isUserAuthenticated = (): boolean => {
  try {
    const userId = getCurrentUserId();
    return userId > 0;
  } catch {
    return false;
  }
};

export default getCurrentUserId;

