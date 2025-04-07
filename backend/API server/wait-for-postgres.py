import socket
import time
import os
import sys

def wait_for_postgres(host, port, timeout=30):
    """Ждет доступности PostgreSQL через сокет."""
    print(f"⏳ Ожидание PostgreSQL на {host}:{port}...")
    start_time = time.time()
    while True:
        try:
            with socket.create_connection((host, port), timeout=1):
                print(f"✅ PostgreSQL на {host}:{port} доступен!")
                return True
        except (socket.timeout, ConnectionRefusedError, socket.gaierror) as e:
            # socket.gaierror - если имя хоста не резолвится
            print(f"   (ошибка: {type(e).__name__}, ждем...)")
            if time.time() - start_time >= timeout:
                print(f"❌ Таймаут ({timeout} сек) ожидания PostgreSQL на {host}:{port}.")
                return False
            time.sleep(1)

if __name__ == "__main__":
    # Берем хост и порт из переменных окружения, которые заданы в docker-compose и .env
    # Очень важно, чтобы POSTGRES_HOST был именем сервиса (например, 'postgres'), а не 'localhost'
    pg_host = os.environ.get("POSTGRES_HOST", "postgres")
    pg_port = int(os.environ.get("POSTGRES_PORT", 5432))

    if not wait_for_postgres(pg_host, pg_port):
        sys.exit(1) # Выходим с ошибкой, если не дождались

    print("🚀 PostgreSQL готов, продолжаем запуск...")
    # Скрипт успешно завершается, Docker Compose перейдет к следующей части команды (uvicorn) 