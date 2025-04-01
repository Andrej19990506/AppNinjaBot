# Базовый образ для разработки
FROM node:18-alpine as builder

WORKDIR /app

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем все зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Для режима разработки
FROM builder as development
ENV NODE_ENV=development
ENV PATH /app/node_modules/.bin:$PATH

# Устанавливаем craco глобально и даем права на выполнение
RUN npm install -g @craco/craco && \
    chmod -R 755 /app/node_modules/.bin

# Создаем entrypoint скрипт
RUN echo '#!/bin/sh' > /usr/local/bin/docker-entrypoint.sh && \
    echo 'if [ -f /app/.env.runtime ]; then' >> /usr/local/bin/docker-entrypoint.sh && \
    echo '  export $(cat /app/.env.runtime | xargs)' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'fi' >> /usr/local/bin/docker-entrypoint.sh && \
    echo 'exec "$@"' >> /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]

# Для продакшен сборки
FROM builder as production-build
ENV NODE_ENV=production
RUN npm run build

# Финальный продакшен образ
FROM nginx:alpine as production
COPY --from=production-build /app/build /usr/share/nginx/html

# Копируем конфигурацию nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем entrypoint скрипт для подстановки переменных окружения
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js' >> /docker-entrypoint.sh && \
    echo 'exec "$@"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"] 