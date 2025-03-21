# Миграция AppNinjaBot на Kubernetes

## Необходимые компоненты

1. Docker Desktop с включенным Kubernetes
2. kubectl (устанавливается вместе с Docker Desktop)

## Шаги по миграции

### 1. Установка Docker Desktop

1. Скачайте установщик Docker Desktop с [официального сайта](https://www.docker.com/products/docker-desktop)
2. Установите Docker Desktop
3. В настройках Docker Desktop включите Kubernetes:
   - Откройте Docker Desktop
   - Перейдите в Settings (Настройки)
   - Выберите вкладку Kubernetes
   - Включите опцию "Enable Kubernetes" (Включить Kubernetes)
   - Нажмите "Apply & Restart" (Применить и перезапустить)

### 2. Сборка образов

Сначала нужно собрать образы для всех компонентов:

```bash
# Убедитесь, что вы находитесь в корневой директории проекта
docker build -t appninjabot-frontend ./frontend
docker build -t appninjabot-server ./backend
docker build -t appninjabot-bot -f ./backend/telegramNinjaBot/Dockerfile ./backend/telegramNinjaBot
docker build -t appninjabot-scheduler ./backend
```

### 3. Запуск в Kubernetes

Запустите скрипт для автоматического развертывания всех компонентов:

```bash
cd kubernetes
deploy-all.bat
```

### 4. Проверка статуса

Проверьте, что все поды запущены и работают:

```bash
kubectl get pods
kubectl get services
```

### 5. Доступ к приложению

- Frontend будет доступен по адресу http://localhost:XXXX (порт назначается автоматически)
- API будет доступен по адресу http://localhost:YYYY (порт назначается автоматически)

Скрипт `deploy-all.bat` выведет точные адреса после запуска.

### 6. Настройка доступа из интернета

Для настройки доступа из интернета существует несколько вариантов:

1. Использовать Ingress и настроить доменное имя (требует публичного IP-адреса)
2. Использовать туннели (например, ngrok)
3. Настроить проброс портов на роутере (если у вас есть публичный IP-адрес)

## Преимущества Kubernetes

1. Автоматическое восстановление после сбоев
2. Масштабирование компонентов
3. Улучшенная отказоустойчивость
4. Удобное управление конфигурацией 