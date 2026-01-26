
FROM node:22 as builder

WORKDIR /app

ARG VITE_APP_API_URL
ARG VITE_APP_WS_URL
ARG VITE_YANDEX_DISK_TOKEN

COPY package.json package-lock.json ./
RUN npm ci 

COPY . .

ENV NODE_ENV=production
ENV VITE_API_URL=${VITE_APP_API_URL}
ENV VITE_WS_URL=${VITE_APP_WS_URL}
ENV VITE_YANDEX_DISK_TOKEN=${VITE_YANDEX_DISK_TOKEN}

RUN npm run build

FROM builder as production-build
