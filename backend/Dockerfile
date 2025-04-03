FROM python:3.11-slim as base

WORKDIR /app

COPY requirements.txt .

# Устанавливаем часовой пояс
RUN apt-get update && apt-get install -y tzdata && \
    ln -fs /usr/share/zoneinfo/Asia/Krasnoyarsk /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata

# Увеличиваем таймаут для pip до 180 секунд
RUN pip install --no-cache-dir -r requirements.txt --timeout 180

# Создаем необходимые директории
RUN mkdir -p /app/data/templates \
    && mkdir -p /app/data/inventory \
    && mkdir -p /app/data/scheduler \
    && mkdir -p /app/telegramNinjaBot/data

# Устанавливаем PYTHONPATH
ENV PYTHONPATH=/app

# Копируем шаблон инвентаризации
COPY data/templates/inventory_template.json /app/data/templates/

FROM base as development
# В development stage копируем все файлы
COPY . .
ENV ENVIRONMENT=development
CMD ["python", "-u", "app.py"]

FROM base as production
# В production stage копируем все файлы
COPY . .
ENV ENVIRONMENT=production
ENV PYTHONOPTIMIZE=1
# Используем gunicorn для production
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000", "--workers", "4", "--worker-class", "uvicorn.workers.UvicornWorker", "--access-logfile", "-", "--error-logfile", "-"] 