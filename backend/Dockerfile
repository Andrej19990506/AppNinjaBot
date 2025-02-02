FROM python:3.10-slim as base

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Создаем необходимые директории
RUN mkdir -p /app/data/templates /app/data/inventory

# Копируем шаблон
COPY ./data/templates/inventory_template.json /app/data/templates/

FROM base as development
COPY . .
CMD ["python", "app.py"]

FROM base as production
COPY . .
CMD ["python", "app.py"] 