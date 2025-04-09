# Стадия 1: Используем образ server как базу для копирования core
FROM appninjabot-server AS server_base

# Стадия 2: Основная сборка scheduler
FROM python:3.11-slim
WORKDIR /app

# Копируем папку core из стадии server_base
COPY --from=server_base /app/core /app/core/

# Копируем файл зависимостей
COPY requirements.txt /app/requirements.txt

# Устанавливаем зависимости
# --no-cache-dir используется для уменьшения размера образа
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальной код scheduler
COPY . /app

# Устанавливаем переменную окружения для Python
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Запускаем приложение
CMD ["python", "app.py"] 