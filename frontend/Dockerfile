
FROM node:22 as builder

WORKDIR /app

ARG VITE_APP_API_URL
ARG VITE_APP_WS_URL

COPY package.json package-lock.json ./
RUN npm ci 

COPY . .

ENV NODE_ENV=production

RUN npm run build

FROM builder as production-build
