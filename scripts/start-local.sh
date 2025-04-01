#!/bin/bash

# Скрипт для запуска локальной среды разработки

# Переменные
COMPOSE_PROJECT_NAME=appninjabot-dev

# Проверка наличия .env файлов
if [ ! -f ./backend/.env ]; then
    echo "Копирование .env.example в .env для backend..."
    cp ./backend/.env.example ./backend/.env
fi

if [ ! -f ./backend/telegramNinjaBot/.env ]; then
    echo "Копирование .env.example в .env для telegramNinjaBot..."
    cp ./backend/telegramNinjaBot/.env.example ./backend/telegramNinjaBot/.env
fi

if [ ! -f ./frontend/.env.docker ]; then
    echo "Копирование .env.example в .env.docker для frontend..."
    cp ./frontend/.env.example ./frontend/.env.docker
fi

# Запуск Docker Compose
echo "Запуск локальной среды разработки..."
export COMPOSE_PROJECT_NAME
docker-compose up --build -d

# Проверка статуса
echo "Проверка статуса сервисов..."
docker-compose ps

echo ""
echo "Локальная среда запущена!"
echo "API доступен по адресу: http://localhost:8000"
echo "Фронтенд доступен по адресу: http://localhost:3000"
echo "WebSocket сервис доступен по адресу: http://localhost:8001"
echo "Веб-интерфейс для тестирования WebSocket: http://localhost"
echo ""
echo "Для просмотра логов используйте: docker-compose logs -f [имя_сервиса]"
echo "Для остановки среды используйте: docker-compose down" 