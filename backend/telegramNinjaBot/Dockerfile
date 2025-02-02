FROM python:3.11-slim as base

WORKDIR /app

# Копируем requirements.txt из текущей директории
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Добавляем текущую директорию в PYTHONPATH
ENV PYTHONPATH=/app

# Создаем директории для данных и кэша
RUN mkdir -p data && \
    mkdir -p data/photos && \
    mkdir -p handlers/__pycache__ && \
    mkdir -p services/__pycache__

FROM base as development
# Копируем код приложения
COPY . .
# В режиме разработки используем python с флагом -u для вывода логов без буферизации
CMD ["python", "-u", "bot.py"]

FROM base as production
# Копируем код приложения
COPY . .
# В продакшене используем обычный запуск
CMD ["python", "bot.py"] 