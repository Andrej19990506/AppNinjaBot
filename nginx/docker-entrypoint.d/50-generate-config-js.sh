#!/bin/sh
set -e

# Используем путь напрямую

echo "--- Script 50-generate-config-js.sh starting ---"
echo "Target file: /usr/share/nginx/html/config.js"

# Создаем директорию
mkdir -p /usr/share/nginx/html
if [ ! -d /usr/share/nginx/html ]; then
    echo "Error: Failed to create /usr/share/nginx/html" >&2
    exit 1
fi

# ЛОГИРУЕМ ПЕРЕМЕННЫЕ ПЕРЕД ИСПОЛЬЗОВАНИЕМ
echo "Checking environment variables:"
echo "  REACT_APP_API_URL='${REACT_APP_API_URL}'"
echo "  REACT_APP_WS_URL='${REACT_APP_WS_URL}'"
echo "  ENV_TYPE='${ENV_TYPE}'"
echo "  REACT_APP_DEBUG='${REACT_APP_DEBUG}'"

# ПРОВЕРКА НА ПУСТОТУ
if [ -z "${REACT_APP_API_URL}" ] || [ -z "${REACT_APP_WS_URL}" ] || [ -z "${ENV_TYPE}" ] || [ -z "${REACT_APP_DEBUG}" ]; then
     echo "Error: One or more required environment variables are empty! Exiting." >&2
     exit 1
fi

echo "Generating /usr/share/nginx/html/config.js content..."

# Генерация файла с правильными заголовками для мобильной совместимости
cat > "/usr/share/nginx/html/config.js" <<INNER_EOF
// AppNinjaBot Runtime Configuration
// Generated at: $(date -Iseconds)
// Environment: ${ENV_TYPE}

(function() {
    'use strict';
    
    // Проверяем поддержку window объекта
    if (typeof window === 'undefined') {
        console.error('Config.js: window object not available');
        return;
    }
    
    // Создаем конфигурацию
    window.APP_CONFIG = {
        API_URL: "$(printf '%s' "${REACT_APP_API_URL}")",
        WS_URL: "$(printf '%s' "${REACT_APP_WS_URL}")",
        ENV: "$(printf '%s' "${ENV_TYPE}")",
        DEBUG: "$(printf '%s' "${REACT_APP_DEBUG}")",
        GENERATED_AT: "$(date -Iseconds)",
        USER_AGENT_INFO: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
    };
    
    // Логируем загрузку конфигурации для отладки
    if (window.APP_CONFIG.DEBUG === 'true') {
        console.log('AppNinjaBot Config loaded:', window.APP_CONFIG);
    }
    
    // Отправляем событие о загрузке конфигурации
    if (typeof window.dispatchEvent === 'function') {
        try {
            window.dispatchEvent(new CustomEvent('appConfigLoaded', { 
                detail: window.APP_CONFIG 
            }));
        } catch (e) {
            console.warn('Could not dispatch appConfigLoaded event:', e);
        }
    }
})();
INNER_EOF

# Проверяем, что файл создался
if [ ! -f "/usr/share/nginx/html/config.js" ]; then
    echo "Error: Failed to create /usr/share/nginx/html/config.js" >&2
    exit 1
fi

# Проверяем содержимое файла
FILE_SIZE=$(wc -c < "/usr/share/nginx/html/config.js")
if [ "${FILE_SIZE}" -lt 100 ]; then
    echo "Error: Generated config.js file is too small (${FILE_SIZE} bytes)" >&2
    exit 1
fi

# Выставляем права
chmod 644 "/usr/share/nginx/html/config.js"
chown nginx:nginx "/usr/share/nginx/html/config.js" 2>/dev/null || echo "Warning: Couldn't chown /usr/share/nginx/html/config.js, maybe running as root or user nginx doesn't exist?"

echo "--- Generated /usr/share/nginx/html/config.js content: ---"
cat "/usr/share/nginx/html/config.js"
echo "--- File size: ${FILE_SIZE} bytes ---"
echo "--- Script 50-generate-config-js.sh finished successfully ---"

exit 0 