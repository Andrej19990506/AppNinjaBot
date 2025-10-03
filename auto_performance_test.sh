#!/bin/bash

echo "🚀 Автоматизированный тест производительности AppNinjaBot"
echo "=================================================="

# Проверяем, что сервисы запущены
echo "📋 Проверяем статус сервисов..."
docker-compose ps

# Проверяем доступность API
echo "🔍 Проверяем доступность API..."
curl -f http://localhost:8000/health || {
    echo "❌ API недоступен!"
    exit 1
}

echo "✅ API доступен"

# Запускаем тест производительности
echo "🧪 Запускаем нагрузочный тест..."
python3 performance_test.py

# Собираем метрики
echo "📊 Собираем метрики..."
echo "--- Docker Stats ---"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo "--- PostgreSQL Connections ---"
docker exec appninjabot_postgres_1 psql -U postgres -d appninjabot -c "SELECT count(*) as active_connections FROM pg_stat_activity;"

echo "--- Recent Errors ---"
docker-compose logs server --tail=20 | grep -i "error\|exception" || echo "Нет ошибок в логах"

echo "✅ Тест завершен!"
