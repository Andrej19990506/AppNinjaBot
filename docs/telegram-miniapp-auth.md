# План авторизации через Telegram Mini App

## 1. Бэкенд

- **Конфигурация**
  - Добавить переменные окружения: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_BOTS`, `TELEGRAM_INITDATA_MAX_AGE`, `JWT_SECRET_KEY`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`.
  - Обновить `.env`-шаблоны и `docker-compose` (prod/dev) новыми параметрами.

- **Валидация initData**
  - Создать модуль `auth/telegram.py` (в `api/v1` или `core`):
    - Парсер `init_data` из строки в `dict`.
    - Проверка подписи (HMAC-SHA256 по токену бота).
    - Проверка `auth_date` на возраст.
    - Проверка имени/ID бота на попадание в whitelist.
  - Добавить unit-тесты: корректный/битый хеш, просроченный `auth_date`, запрещённый бот.

- **Эндпоинт авторизации**
  - `POST /api/v1/auth/telegram/webapp`:
    1. Принимает `init_data`.
    2. Валидирует через модуль.
    3. Находит или создаёт `Member` (обновляет имя, username, фото).
    4. Опционально дергает бот-сервис для актуализации профиля (за фичефлагом).
    5. Формирует `user_payload`: профиль + список групп.
    6. Выдаёт access/refresh токены (JWT) или ставит HttpOnly cookie.
    7. Возвращает `{access_token, refresh_token, user}` (или только `user`, если cookie).

- **Общий Depends**
  - Реализовать `get_current_member`:
    - Читает bearer/cookie, валидирует JWT, проверяет срок действия.
    - Возвращает объект `Member`.

- **Защищаем ручки**
  - Шаг 1: `/api/v1/users/{id}/context`, `/profile` — требуют авторизацию.
  - Шаг 2: ключевые CRUD (`inventory`, `shifts`, `write_offs`) — убираем `requester_telegram_id`, используем `current_user`.
  - Логируем отказы без хранения `init_data`.

- **Refresh / logout**
  - `POST /api/v1/auth/refresh` — ротация refresh-токена.
  - `POST /api/v1/auth/logout` — инвалидирует refresh (хранение в Redis/Postgres).

- **WebSocket**
  - В `websocket-service`:
    - Хэндшейк теперь принимает `auth: { token: <bearer> }`.
    - Проверка токена через общий модуль (HTTP-запрос или shared lib).
    - При ошибке — `disconnect`.
    - Кешировать пользователя (ID, группы) в Redis.

## 2. Telegram Mini App (web-frontend)

- **Авторизация**
  - При старте (`AppInitializer`):
    - Получить `window.Telegram.WebApp.initData`.
    - Отправить в `/auth/telegram/webapp`.
    - Сохранить access (в памяти/Redux), refresh (cookie/secure storage).
    - Из ответа брать `user` и `groups` вместо ручного `getUserContext`.
  - Обновить `initializeFromTelegram`:
    - Убрать dev-заглушку (оставить за флагом `VITE_ALLOW_FAKE_USER`).
    - Обрабатывать ошибки refresh/token.

- **HTTP клиент**
  - В axios поставить `Authorization: Bearer`.
  - Интерцептор на `401` → запрос `refresh`, повтор оригинального запроса.

- **Сокеты**
  - Перед `socketService.connect` передавать токен в `auth`.
  - После обновления токена — пересоздавать соединение.

- **UI**
  - Состояния: загрузка, истекшая сессия, отсутствие прав.
  - Кнопка “Войти снова” очищает токены и перезапускает initData flow.

## 3. React Native (FlowixApp)

- **Deep linking**
  - Android `AndroidManifest` `<data android:scheme="flowixapp" android:host="auth">`.
  - iOS `Info.plist` `CFBundleURLTypes`.
  - В `App.tsx` слушать `Linking.addEventListener('url', ...)`.

- **Авторизация**
  - Из deep link достать `payload`, отправить в `/auth/telegram/webapp`.
  - Сохранить токены в `SecureStore`/`Keychain`.
  - Axios/RTK Query — добавлять `Authorization: Bearer`.

- **Старт**
  - Пока нет токена: экран “Откройте Flowix через Telegram”.
  - После логина — основной UI.

- **Обновление**
  - Refresh по `401` или фоновой задаче.
  - Logout: очистка SecureStore и возврат к экрану ожидания.

## 4. Общее и DevOps

- Документировать новые env (`.env`, `README`, CI/CD).
- Настроить секьюрные секреты для JWT, refresh.
- Обновить docker-образы / сборку, убедиться, что модуль авторизации и секреты попадают в контейнер.
- Тесты:
  - unit: валидация initData.
  - интеграция: `/auth/telegram/webapp`, `get_current_member`.
  - e2e: Mini App с моканым Telegram (Cypress).
- Логи: не сохранять `init_data`, выводить только причины отказа.

## 5. Плавный переход

- На первых релизах поддерживать `requester_telegram_id`, но логировать предупреждение.
- На фронте сначала использовать новый эндпоинт с фолбэком, затем полностью отключить старый путь.
- Оповестить команду/DevOps о токенах и новых секретах.

## 6. Следующий этап — авторизация через бота

- `/start <payload>` генерирует одноразовый токен → `/api/v1/auth/telegram/bot`.
- Общая таблица сессий для Mini App и бота (единый формат токенов).
- API для отзыва сессий (админы бота, безопасность).

## 7. Вопросы для уточнения

- JWT vs HttpOnly cookie (зависит от домена и сценариев).
- Токены бота для dev/stage/prod.
- Сроки жизни и политика ревокации токенов (особенно для админов/курьеров).


