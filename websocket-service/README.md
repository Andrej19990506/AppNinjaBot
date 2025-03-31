# WebSocket Service

Отдельный микросервис для обработки WebSocket соединений в приложении AppNinjaBot.

## Особенности

- FastAPI + Socket.IO для WebSocket соединений
- Redis для кластеризации и хранения состояния
- Prometheus метрики для мониторинга
- Health check эндпоинт
- CORS настройки
- Логирование

## Требования

- Python 3.11+
- Redis
- Docker (опционально)

## Установка

1. Клонируйте репозиторий
2. Установите зависимости:
   ```bash
   pip install -r requirements.txt
   ```

## Запуск

### Локально

```bash
python src/server.py
```

### В Docker

```bash
docker build -t websocket-service .
docker run -p 8001:8001 websocket-service
```

## Конфигурация

Создайте файл `.env` в корневой директории:

```env
PORT=8001
REDIS_URL=redis://redis:6379
HOST=0.0.0.0
```

## API

### WebSocket Endpoints

- `/ws` - WebSocket соединение
- `/metrics` - Prometheus метрики
- `/health` - Health check

## Метрики

- `websocket_connected_clients` - Количество подключенных клиентов
- `websocket_messages_sent` - Количество отправленных сообщений

## Разработка

1. Создайте виртуальное окружение:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate     # Windows
   ```

2. Установите зависимости:
   ```bash
   pip install -r requirements.txt
   ```

3. Запустите сервер в режиме разработки:
   ```bash
   python src/server.py
   ``` 