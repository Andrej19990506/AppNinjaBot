@echo off
echo Запуск проекта с использованием Podman...

REM Остановить существующие контейнеры Docker если они запущены
echo Останавливаем существующие контейнеры Docker...
docker-compose down

REM Запуск с использованием podman-compose
echo Запускаем проект с использованием Podman...
podman-compose -f podman-compose.yml up -d

echo Проект запущен! Проверяем состояние контейнеров:
podman ps

echo.
echo Для просмотра логов frontend контейнера:
echo podman logs -f tunnel-frontend
echo.
echo Для просмотра логов API контейнера:
echo podman logs -f tunnel-api
echo.
echo Для остановки всех контейнеров:
echo podman-compose -f podman-compose.yml down 