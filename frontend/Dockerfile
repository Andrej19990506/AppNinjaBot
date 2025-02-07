# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Сначала копируем только файлы package.json и package-lock.json
# Это позволит кешировать слой с node_modules
COPY package*.json ./
RUN npm install

# Копируем исходный код и env файлы
COPY . .

# Для режима разработки
FROM builder as development
ENV NODE_ENV=development
# Добавляем скрипт для подстановки переменных окружения
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]

# Для продакшен сборки
FROM builder as production
RUN npm run build

FROM nginx:alpine as prod-stage
COPY --from=production /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 