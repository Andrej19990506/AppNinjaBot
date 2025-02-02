#!/bin/bash

# Запускаем туннель для фронтенда
echo "Запускаем туннель для фронтенда..."
ssh -R 80:localhost:3000 localhost.run &
FRONTEND_PID=$!

# Запускаем туннель для API
echo "Запускаем туннель для API..."
ssh -R 80:localhost:8000 localhost.run &
API_PID=$!

# Функция для корректного завершения
cleanup() {
    echo "Завершаем работу туннелей..."
    kill $FRONTEND_PID
    kill $API_PID
    exit 0
}

# Перехватываем CTRL+C
trap cleanup SIGINT

# Ждем завершения
wait 