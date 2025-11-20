# Настройка Docker для лендинга

## Конфигурация

Лендинг настроен для работы в Docker контейнере на порту **3002**.

## Структура

- **Dockerfile**: Многостадийная сборка для оптимизации размера образа
- **docker-compose.yml**: Сервис `landing` добавлен в общий compose файл
- **next.config.ts**: Включен режим `standalone` для оптимизации

## Порты

- **3002** - Лендинг (Next.js)
- **3001** - Grafana (мониторинг)
- **3000** - Не используется (можно использовать для dev режима)

## Запуск

### Сборка и запуск
```bash
docker-compose up -d landing
```

### Просмотр логов
```bash
docker-compose logs -f landing
```

### Пересборка после изменений
```bash
docker-compose build landing
docker-compose up -d landing
```

## Переменные окружения

В `docker-compose.yml` настроены:
- `NODE_ENV=production`
- `PORT=3002`
- `NEXT_PUBLIC_API_URL` - URL API сервера (по умолчанию `http://localhost:8000/api`)

## Доступ

После запуска лендинг будет доступен:
- **Локально**: `http://localhost:3002`
- **Админ-панель**: `http://localhost:3002/admin`

## Разработка

Для разработки можно запускать локально без Docker:
```bash
cd flowix-landing-ssr
npm install
npm run dev
```

Лендинг будет доступен на `http://localhost:3000` (стандартный порт Next.js)

