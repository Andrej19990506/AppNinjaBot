# Архитектура системы ролей и функционала для компаний

## Проблема

1. **Разные компании с разными ролями:**
   - Ниндзя Пицца: курьеры, повара, отдел закупа
   - Банк Бир: продавцы (работают с инвентаризацией)

2. **Привязка групп к функционалу:**
   - Группа должна иметь определенный функционал (инвентаризация, смены, закупки)
   - Например, группа продавцов в Банк Бир должна иметь функционал инвентаризации

3. **Уведомления в разные группы:**
   - Когда происходит инвентаризация в Банк Бир, Excel файл должен отправляться:
     - В группу продавцов (где работает бот)
     - В группу начальства (только для получения файлов, без функционала бота)

## Решение

### Архитектура данных

```
CompanyBot (бот компании)
    ↓
CompanyRole (роли компании)
    - role_name: "Повар", "Курьер", "Продавец"
    - role_code: "chef", "courier", "seller"
    ↓
BotFeature (функционал бота)
    - feature_code: "inventory", "shifts", "purchasing", "notifications"
    - feature_name: "Инвентаризация", "Смены", "Закупки"
    ↓
RoleFeatureMapping (связь роли с функционалом)
    - company_role_id → CompanyRole
    - bot_feature_id → BotFeature
    ↓
Group (группа Telegram)
    ↓
GroupRoleMapping (связь группы с ролью)
    - group_id → Group
    - company_role_id → CompanyRole
    - is_working_group: true/false (рабочая группа или только уведомления)
    ↓
GroupFeatureNotification (уведомления для функций)
    - bot_feature_id → BotFeature
    - working_group_id → Group (рабочая группа)
    - notification_group_id → Group (группа для уведомлений)
```

### Структура таблиц

#### 1. `bot_features` - Функционал бота
```sql
- id
- feature_code: "inventory", "shifts", "purchasing", "notifications"
- feature_name: "Инвентаризация", "Смены", "Закупки", "Уведомления"
- description
- is_active
```

#### 2. `company_roles` - Роли компании
```sql
- id
- company_bot_id → company_bots.id
- role_name: "Повар", "Курьер", "Продавец"
- role_code: "chef", "courier", "seller"
- description
- icon, color, display_order
```

#### 3. `role_feature_mappings` - Связь роли с функционалом
```sql
- id
- company_role_id → company_roles.id
- bot_feature_id → bot_features.id
- is_enabled: true/false (включен ли функционал для роли)
```

#### 4. `group_role_mappings` - Связь группы с ролью
```sql
- id
- group_id → groups.group_id
- company_role_id → company_roles.id
- is_working_group: true/false
  - true: группа работает с ботом (функционал активен)
  - false: группа только для уведомлений (получает файлы, но бот не работает)
```

#### 5. `group_feature_notifications` - Уведомления для функций
```sql
- id
- bot_feature_id → bot_features.id
- working_group_id → groups.group_id (рабочая группа)
- notification_group_id → groups.group_id (группа для уведомлений)
- notification_type: "excel", "message", "file"
```

## Пример использования

### Сценарий 1: Ниндзя Пицца

1. **Создаем роли:**
   - Роль "Повар" (chef) → функции: инвентаризация, закупки
   - Роль "Курьер" (courier) → функции: смены
   - Роль "Отдел закупа" (purchasing) → функции: закупки, уведомления

2. **Привязываем группы:**
   - Группа "Повара Ниндзя Пицца" → роль "Повар" (is_working_group=true)
   - Группа "Курьеры Ниндзя Пицца" → роль "Курьер" (is_working_group=true)
   - Группа "Отдел закупа Ниндзя" → роль "Отдел закупа" (is_working_group=true)

### Сценарий 2: Банк Бир

1. **Создаем роли:**
   - Роль "Продавец" (seller) → функции: инвентаризация
   - Роль "Начальство" (management) → функции: уведомления (только получение)

2. **Привязываем группы:**
   - Группа "Продавцы Банк Бир" → роль "Продавец" (is_working_group=true)
   - Группа "Начальство Банк Бир" → роль "Начальство" (is_working_group=false)

3. **Настраиваем уведомления:**
   - Функция "Инвентаризация":
     - Рабочая группа: "Продавцы Банк Бир"
     - Уведомительная группа: "Начальство Банк Бир"
   - Когда происходит инвентаризация:
     - Excel файл отправляется в обе группы
     - Но бот работает только в группе продавцов

## Логика работы

### Определение функционала группы

```python
def get_group_features(group_id):
    # 1. Получаем роль группы
    role_mapping = get_group_role_mapping(group_id)
    if not role_mapping or not role_mapping.is_working_group:
        return []  # Группа только для уведомлений
    
    # 2. Получаем функции роли
    role = role_mapping.company_role
    features = get_role_features(role.id)
    
    return features
```

### Отправка уведомлений

```python
def send_inventory_excel(group_id, excel_file):
    # 1. Находим рабочую группу
    working_group = get_group(group_id)
    
    # 2. Находим все группы для уведомлений по функции "inventory"
    notification_groups = get_notification_groups(
        feature_code="inventory",
        working_group_id=group_id
    )
    
    # 3. Отправляем в рабочую группу
    send_to_group(working_group.group_id, excel_file)
    
    # 4. Отправляем в уведомительные группы
    for notif_group in notification_groups:
        send_to_group(notif_group.notification_group_id, excel_file)
```

## API Endpoints

### Управление ролями
- `GET /v1/company-roles/{company_bot_id}` - получить роли компании
- `POST /v1/company-roles` - создать роль
- `PUT /v1/company-roles/{role_id}` - обновить роль
- `DELETE /v1/company-roles/{role_id}` - удалить роль

### Управление функционалом
- `GET /v1/bot-features` - получить все функции
- `POST /v1/role-feature-mappings` - привязать функцию к роли
- `DELETE /v1/role-feature-mappings/{mapping_id}` - отвязать функцию от роли

### Управление группами
- `POST /v1/group-role-mappings` - привязать группу к роли
- `PUT /v1/group-role-mappings/{mapping_id}` - обновить привязку (изменить is_working_group)
- `GET /v1/groups/{group_id}/features` - получить функции группы

### Управление уведомлениями
- `POST /v1/group-feature-notifications` - настроить уведомления для функции
- `GET /v1/group-feature-notifications?feature_code=inventory&working_group_id=...` - получить группы для уведомлений
- `DELETE /v1/group-feature-notifications/{notification_id}` - удалить настройку уведомлений

