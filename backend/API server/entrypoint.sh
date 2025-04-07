#!/bin/sh

# Выходим при любой ошибке
set -e

# Установка зависимостей (можно убрать, если они ставятся в Dockerfile)
# echo "Installing requirements..."
# pip install -r requirements.txt

# Ожидание Postgres
echo "Waiting for PostgreSQL..."
python wait-for-postgres.py

# Применение миграций
echo "Applying Alembic migrations..."
alembic upgrade head

# Запуск Uvicorn
echo "Starting Uvicorn..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app 