#!/bin/bash

# Запуск в development режиме
docker-compose up --build -d

# Запуск фронтенда
cd frontend && npm start 