FROM python:3.11-slim as base

WORKDIR /app

COPY requirements.txt .

# Увеличиваем таймаут для pip до 180 секунд
RUN pip install --no-cache-dir -r requirements.txt --timeout 180

# Создаем необходимые директории
RUN mkdir -p /app/data/templates \
    && mkdir -p /app/data/inventory \
    && mkdir -p /app/telegramNinjaBot/data

# Устанавливаем PYTHONPATH
ENV PYTHONPATH=/app

# Копируем все файлы приложения
COPY . .

# Копируем шаблон инвентаризации
COPY data/templates/inventory_template.json /app/data/templates/

FROM base as development
CMD ["python", "-u", "app.py"]

FROM base as production
CMD ["python", "app.py"] 