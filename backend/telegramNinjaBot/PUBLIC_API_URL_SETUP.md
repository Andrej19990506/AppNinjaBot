# Настройка PUBLIC_API_URL для авторизации через бота

## Проблема
Telegram Bot API не принимает внутренние Docker URL (`http://server:8000`) или `localhost` в кнопках. Нужен публичный URL, доступный из интернета.

## Решение

### Вариант 1: Использовать ngrok (для локальной разработки)

1. Установите ngrok: https://ngrok.com/download
2. Запустите туннель для API:
   ```bash
   ngrok http 8000
   ```
3. Скопируйте HTTPS URL (например, `https://abc123.ngrok.io`)
4. Обновите `docker-compose.override.yml`:
   ```yaml
   bot:
     environment:
       - PUBLIC_API_URL=https://abc123.ngrok.io
   ```
5. Перезапустите бота:
   ```bash
   docker-compose restart bot
   ```

### Вариант 2: Использовать публичный IP (если доступен)

Если ваш компьютер имеет публичный IP и порт 8000 открыт:

```yaml
bot:
  environment:
    - PUBLIC_API_URL=http://YOUR_PUBLIC_IP:8000
```

### Вариант 3: Использовать домен (для продакшена)

```yaml
bot:
  environment:
    - PUBLIC_API_URL=https://api.appninjabot.ru
```

## Проверка

После настройки проверьте логи бота:
```bash
docker-compose logs bot | grep "API URL"
```

Должно быть:
```
API URL (внутренний): http://server:8000
API URL (публичный): https://your-public-url.com
```

## Важно

- `API_URL` используется для внутренних запросов между сервисами Docker
- `PUBLIC_API_URL` используется для кнопок в Telegram и должен быть доступен из интернета
- Для локальной разработки обязательно используйте ngrok или другой туннель

