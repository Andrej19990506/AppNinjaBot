#!/bin/bash

# Скрипт для деплоя на продакшен сервер

# Проверка параметров
if [ "$#" -ne 1 ]; then
    echo "Использование: $0 <ssh_user@host>"
    exit 1
fi

SERVER=$1
PROJECT_DIR="/var/www/appninjabot"
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"

# Подготовка локальных файлов для деплоя
echo "Подготовка к деплою..."

# Сборка и перенос файлов на сервер
echo "Копирование файлов на сервер..."
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'data' \
      --exclude '.env' --exclude '*.pyc' --exclude '__pycache__' \
      ./ ${SERVER}:${PROJECT_DIR}/

# Копирование .env файлов если они не существуют на сервере
ssh ${SERVER} "[ -f ${PROJECT_DIR}/backend/.env ] || cp ${PROJECT_DIR}/backend/.env.example ${PROJECT_DIR}/backend/.env"
ssh ${SERVER} "[ -f ${PROJECT_DIR}/backend/telegramNinjaBot/.env ] || cp ${PROJECT_DIR}/backend/telegramNinjaBot/.env.example ${PROJECT_DIR}/backend/telegramNinjaBot/.env"

# Деплой на сервере
echo "Деплой на сервере..."
ssh ${SERVER} "cd ${PROJECT_DIR} && docker-compose ${COMPOSE_FILES} build && docker-compose ${COMPOSE_FILES} up -d"

# Проверка статуса
echo "Проверка статуса сервисов..."
ssh ${SERVER} "cd ${PROJECT_DIR} && docker-compose ${COMPOSE_FILES} ps"

echo "Деплой завершен!" 