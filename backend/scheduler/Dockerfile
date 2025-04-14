# Стандартизируем контекст сборки и структуру файлов
FROM python:3.11-slim as base
WORKDIR /app

# Устанавливаем переменные окружения
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH=/app

# Копируем только requirements.txt сначала, чтобы кэш работал лучше
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt
# Устанавливаем явно asyncpg и httpx
RUN pip install --no-cache-dir asyncpg httpx

# Создаем директорию shared до копирования файлов
RUN mkdir -p /app/shared

# Копируем весь остальной код приложения
COPY . .

# Создаем пустой __init__.py в директории shared, если его нет
RUN mkdir -p /app/shared && touch /app/shared/__init__.py

EXPOSE 8002

# Для разработки используем --reload, для продакшена без него
FROM base as development
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002", "--reload"]

FROM base as production
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"] 