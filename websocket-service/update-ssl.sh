#!/bin/sh

# Проверяем наличие переменных окружения
if [ -z "$CERTBOT_EMAIL" ]; then
    echo "Error: CERTBOT_EMAIL environment variable is not set"
    exit 1
fi

# Получаем SSL-сертификат
certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "$CERTBOT_EMAIL" \
    --domains appninjabot.com,www.appninjabot.com \
    --redirect

# Перезапускаем Nginx
nginx -s reload 