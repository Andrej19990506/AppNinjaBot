# Убираем многоступенчатую сборку, так как контекст теперь ./backend

FROM python:3.11-slim
WORKDIR /app

# Копируем зависимости
COPY scheduler/requirements.txt /app/requirements.txt

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt
# Явно устанавливаем asyncpg, чтобы решить проблему его отсутствия
RUN pip install --no-cache-dir asyncpg

# Копируем общие модули
COPY core/ /app/core/
# Явно копируем модуль shared из backend
COPY shared/ /app/shared/

# Копируем код scheduler (содержимое папки scheduler)
COPY scheduler/. /app/

# Создаем пустой __init__.py в директории shared, если его нет
RUN touch /app/shared/__init__.py

# Устанавливаем переменную окружения для Python
ENV PYTHONUNBUFFERED=1
# Устанавливаем PYTHONPATH только на /app
ENV PYTHONPATH=/app

# CMD для uvicorn теперь соответствует команде в docker-compose
# Оставим для возможного ручного запуска
CMD ["python", "app.py"] 