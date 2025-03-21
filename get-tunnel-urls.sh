#!/bin/bash

# Создадим директорию для хранения URL туннелей, если она не существует
mkdir -p ./tm-urls

# Функция для получения URL туннеля
get_tunnel_url() {
  container=$1
  max_attempts=30
  attempt=0
  
  echo "Waiting for tunnel URL from $container..."
  
  while [ $attempt -lt $max_attempts ]; do
    # Получаем логи контейнера
    logs=$(docker logs $container 2>&1)
    
    # Извлекаем URL туннеля из логов
    tunnel_url=$(echo "$logs" | grep -o 'https://.*\.tunnelmole\.net' | head -1)
    
    if [ -n "$tunnel_url" ]; then
      echo "Found tunnel URL: $tunnel_url"
      echo "$tunnel_url" > "./tm-urls/$container.url"
      return 0
    fi
    
    echo "Attempt $((attempt+1))/$max_attempts: No tunnel URL found yet. Waiting 2 seconds..."
    sleep 2
    attempt=$((attempt+1))
  done
  
  echo "Failed to get tunnel URL after $max_attempts attempts"
  return 1
}

# Запускаем туннельные сервисы
echo "Starting tunnel services..."
docker compose up -d tunnel-frontend tunnel-api

# Получаем URL туннелей
get_tunnel_url "tunnel-api"
API_TUNNEL_URL=$(<./tm-urls/tunnel-api.url)
API_TUNNEL_URL_WS=${API_TUNNEL_URL/https:/wss:}

get_tunnel_url "tunnel-frontend"
FRONTEND_TUNNEL_URL=$(<./tm-urls/tunnel-frontend.url)

# Выводим полученные URL
echo "API Tunnel URL: $API_TUNNEL_URL"
echo "API WebSocket URL: $API_TUNNEL_URL_WS"
echo "Frontend Tunnel URL: $FRONTEND_TUNNEL_URL"

# Создаем файл с переменными окружения
cat > .env.tunnels <<EOF
API_TUNNEL_URL=$API_TUNNEL_URL
API_TUNNEL_URL_WS=$API_TUNNEL_URL_WS
FRONTEND_TUNNEL_URL=$FRONTEND_TUNNEL_URL
EOF

echo "Tunnel URLs have been saved to .env.tunnels"

# Теперь запускаем остальные сервисы с новыми переменными окружения
echo "Starting remaining services with the tunnel URLs..."
docker compose --env-file .env.tunnels up -d bot server scheduler frontend

echo "All services started successfully!" 