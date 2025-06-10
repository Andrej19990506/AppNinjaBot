# 🔧 Исправление проблемы с config.js на мобильном интернете

## 📋 Описание проблемы

**Проблема:** `config.js` загружается через кабельный интернет, но не работает через мобильный интернет.

**Причина:** В продакшн конфигурации использовался стандартный nginx образ без скрипта генерации `config.js`, поэтому файл не создавался при запуске контейнера.

## ✅ Что было исправлено

### 1. **Продакшн Docker Compose конфигурация**
- Заменен стандартный `nginx:stable-alpine` на кастомный build
- Добавлен скрипт генерации `config.js` в образ
- Исправлены переменные окружения

### 2. **Nginx Dockerfile**
- Улучшена поддержка аргумента `NGINX_CONFIG`
- Правильное копирование конфигурационных файлов

### 3. **Скрипт генерации config.js**
- Улучшена мобильная совместимость
- Добавлены проверки и отладочная информация
- Обертка в IIFE для лучшей совместимости

### 4. **Nginx конфигурация**
- Добавлены отладочные endpoint'ы
- Улучшенное логирование
- Специальные заголовки для мобильных устройств

### 5. **Frontend типизация**
- Правильная типизация `APP_CONFIG`
- Улучшенная отладка в API модуле

## 🚀 Развертывание исправлений

### Для Windows (PowerShell):
```powershell
# Развертывание в dev режиме
.\deploy-and-test.ps1 -Command deploy -Environment dev

# Развертывание в продакшн
.\deploy-and-test.ps1 -Command deploy -Environment prod

# Быстрое тестирование
.\deploy-and-test.ps1 -Command test -Url https://appninjabot.ru
```

### Для Linux/Mac (Bash):
```bash
# Развертывание в dev режиме
./deploy-and-test.sh deploy dev

# Развертывание в продакшн
./deploy-and-test.sh deploy prod

# Быстрое тестирование
./deploy-and-test.sh test https://appninjabot.ru
```

### Ручное развертывание:
```bash
# Остановить существующие контейнеры
docker compose down

# Продакшн развертывание
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

# Dev развертывание
docker compose up --build -d
```

## 🔍 Диагностика и отладка

### 1. **Отладочная страница**
Откройте в браузере: `https://appninjabot.ru/debug.html`

Эта страница покажет:
- Статус загрузки config.js
- Информацию о сети и устройстве
- Результаты различных тестов загрузки
- Содержимое config.js

### 2. **Диагностические endpoint'ы**

```bash
# Проверка статуса config.js
curl https://appninjabot.ru/debug/config-status

# Прямая загрузка config.js
curl https://appninjabot.ru/config.js

# Проверка заголовков
curl -I https://appninjabot.ru/config.js
```

### 3. **Логи для отладки**

```bash
# Логи nginx
docker compose logs nginx

# Логи генерации config.js (при запуске)
docker compose logs nginx | grep "generate-config"

# Логи доступа к config.js
docker compose exec nginx tail -f /var/log/nginx/config_js_access.log
```

## 📱 Тестирование на мобильных устройствах

### 1. **Проверка через браузер**
1. Откройте `https://appninjabot.ru/debug.html` на мобильном устройстве
2. Проверьте что config.js загружается успешно
3. Посмотрите информацию о соединении в разделе "Network Info"

### 2. **Проверка через Developer Tools**
```javascript
// Проверка в консоли браузера
console.log('Config loaded:', window.APP_CONFIG);

// Проверка времени загрузки
console.log('Load time:', window.configLoadEnd - window.configLoadStart, 'ms');
```

### 3. **Проверка сетевых условий**
- Проверьте различные типы соединения (3G, 4G, 5G, WiFi)
- Используйте Chrome DevTools для эмуляции медленного соединения
- Проверьте в разных операторов мобильной связи

## 🔧 Структура исправлений

### Ключевые файлы:
```
nginx/
├── Dockerfile.nginx              # ✅ Исправлен
├── nginx.conf                    # ✅ Добавлена отладка
├── nginx.conf.prod.template      # ✅ Добавлена отладка
└── docker-entrypoint.d/
    └── 50-generate-config-js.sh  # ✅ Улучшен

frontend/
├── public/
│   ├── index.html               # ✅ Добавлена диагностика
│   └── debug.html               # ✅ Новая отладочная страница
└── src/
    ├── types/global.d.ts        # ✅ Исправлена типизация
    └── shared/api/api.ts        # ✅ Улучшена отладка

docker-compose.prod.yml          # ✅ Основные исправления
deploy-and-test.ps1              # ✅ Новый скрипт для Windows
deploy-and-test.sh               # ✅ Новый скрипт для Linux/Mac
```

## 🚨 Возможные проблемы и решения

### 1. **Config.js все еще не загружается**
```bash
# Проверьте что скрипт генерации выполнился
docker compose logs nginx | grep "generate-config-js"

# Проверьте что файл существует в контейнере
docker compose exec nginx ls -la /usr/share/nginx/html/config.js

# Проверьте содержимое файла
docker compose exec nginx cat /usr/share/nginx/html/config.js
```

### 2. **Переменные окружения не подставляются**
```bash
# Проверьте переменные окружения в контейнере
docker compose exec nginx env | grep REACT_APP

# Проверьте что все переменные заданы в docker-compose.prod.yml
```

### 3. **Nginx не стартует**
```bash
# Проверьте синтаксис конфигурации
docker compose exec nginx nginx -t

# Проверьте логи запуска
docker compose logs nginx
```

## 📊 Мониторинг после исправления

### Метрики для отслеживания:
1. **Успешность загрузки config.js** - должна быть 100%
2. **Время загрузки** - должно быть < 2 секунд
3. **Ошибки 404/500** - должны отсутствовать для `/config.js`
4. **Мобильный vs десктопный трафик** - одинаковая успешность

### Логи для мониторинга:
```bash
# Доступ к config.js
tail -f nginx_logs/config_js_access.log

# Ошибки при загрузке config.js
tail -f nginx_logs/config_js_error.log

# Общие логи доступа
tail -f nginx_logs/access.log | grep config.js
```

## 🎯 Заключение

Основная проблема была в том, что в продакшн режиме отсутствовал скрипт генерации `config.js`. Теперь:

✅ **Config.js создается правильно** во всех режимах  
✅ **Добавлена подробная диагностика** для быстрого выявления проблем  
✅ **Улучшена мобильная совместимость** с правильными заголовками  
✅ **Автоматизированы тесты** с помощью скриптов развертывания  

После развертывания исправлений приложение должно работать одинаково хорошо как через кабельный, так и через мобильный интернет.

---

**Автор исправлений:** AI Assistant  
**Дата:** $(date)  
**Версия:** 1.0 