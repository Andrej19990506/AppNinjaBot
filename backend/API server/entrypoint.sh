#!/bin/sh

# Выходим при любой ошибке
set -e

# Установка зависимостей (можно убрать, если они ставятся в Dockerfile)
# /bin/sh -c echo "Installing requirements..."
# pip install -r requirements.txt

# Ожидание Postgres
/bin/sh -c echo "Waiting for PostgreSQL..."
python wait-for-postgres.py

# Применение миграций
/bin/sh -c echo "Applying Alembic migrations..."
alembic upgrade head

# Запуск Uvicorn
/bin/sh -c echo "Starting Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload \
    --reload-dir /app/api \
    --reload-dir /app/core \
    --reload-dir /app/db \
    --reload-dir /app/models \
    --reload-dir /app/schemas \
    --reload-dir /app/crud \
    --reload-dir /app/main.py 