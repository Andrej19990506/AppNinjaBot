# Используем базовый образ Python
FROM python:3.9-slim as base

# Устанавливаем рабочую директорию
WORKDIR /app/telegramNinjaBot

# Копируем файлы зависимостей
COPY ./requirements.txt requirements.txt

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Создаем директорию для общего использования
RUN mkdir -p /app/shared

# Stage для разработки
FROM base as development
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=development
ENV PYTHONPATH=/app

# Stage для продакшена
FROM base as production
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV PYTHONPATH=/app

# Копируем все файлы приложения
COPY . /app/telegramNinjaBot

# Создаем директории для данных
RUN mkdir -p /app/telegramNinjaBot/data/photos
RUN mkdir -p /app/telegramNinjaBot/data/videos
RUN mkdir -p /app/telegramNinjaBot/data/inventory
RUN mkdir -p /app/telegramNinjaBot/data/courier_groups

# Настраиваем правильные разрешения
RUN chmod -R 777 /app/telegramNinjaBot/data

# Запускаем бота
CMD ["python", "bot.py"] 