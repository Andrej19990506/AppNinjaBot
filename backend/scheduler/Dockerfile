# Используем официальный образ Python
FROM python:3.11-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем файл зависимостей
COPY ./scheduler/requirements.txt /app/requirements.txt

# Устанавливаем зависимости
# --no-cache-dir используется для уменьшения размера образа
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код приложения
COPY ./scheduler /app/scheduler

# Устанавливаем переменную окружения для Python
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Запускаем приложение
CMD ["python", "scheduler/app.py"] 