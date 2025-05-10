FROM python:3.11-slim as base

WORKDIR /app

# Копируем requirements.txt из текущей директории
COPY requirements.txt .

# Устанавливаем зависимости с увеличенным таймаутом
RUN pip install --no-cache-dir -r requirements.txt --timeout 180

# Создаем директории для данных и кэша
RUN mkdir -p telegramNinjaBot/data && \
    mkdir -p telegramNinjaBot/data/photos && \
    mkdir -p telegramNinjaBot/handlers && \
    mkdir -p telegramNinjaBot/services && \
    mkdir -p telegramNinjaBot/config

# Создаем пустой __init__.py для пакета telegramNinjaBot
RUN touch telegramNinjaBot/__init__.py

# Устанавливаем PYTHONPATH с использованием точки для текущей директории
ENV PYTHONPATH=/app

FROM base as development
# Копируем код приложения в правильную структуру
COPY . /app/telegramNinjaBot/

# В режиме разработки используем python с флагом -u для вывода логов без буферизации
WORKDIR /app
CMD ["python", "-u", "-m", "telegramNinjaBot.bot"]

FROM base as production
# Копируем код приложения в правильную структуру
COPY . /app/telegramNinjaBot/

# В продакшене используем обычный запуск
WORKDIR /app
CMD ["python", "-m", "telegramNinjaBot.bot"] 