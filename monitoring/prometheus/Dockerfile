FROM prom/prometheus:latest

# Копируем конфигурацию
COPY prometheus.yml /etc/prometheus/prometheus.yml

# Открываем порт
EXPOSE 9090

# Запускаем Prometheus (пользователь уже настроен в базовом образе)
CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--web.console.libraries=/etc/prometheus/console_libraries", \
     "--web.console.templates=/etc/prometheus/consoles", \
     "--web.enable-lifecycle"]
