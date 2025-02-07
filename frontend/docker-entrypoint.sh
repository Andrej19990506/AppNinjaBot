#!/bin/sh

# Создаем файл с переменными окружения во время запуска контейнера
echo "REACT_APP_API_URL=$REACT_APP_API_URL" > /app/.env.runtime
echo "REACT_APP_ENV=$REACT_APP_ENV" >> /app/.env.runtime
echo "REACT_APP_DEBUG=true" >> /app/.env.runtime

# Запускаем команду, переданную в CMD
exec "$@" 