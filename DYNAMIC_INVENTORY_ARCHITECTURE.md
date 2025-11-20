# 🏗️ Архитектура динамической системы номенклатур

## 📋 Проблема текущей архитектуры

### Текущее состояние

**Статичная структура:**
- ❌ Один глобальный шаблон `inventory_template.json` для всех компаний
- ❌ Жестко заданная структура: `категория → товар → raw/semifinished`
- ❌ Фиксированные поля товаров: `quantity`, `filled`, `expiry_date`, `warning_days`, `notes`
- ❌ Невозможность кастомизации под разные компании
- ❌ Все компании вынуждены использовать одну номенклатуру

**Проблемы масштабирования:**
- 🚫 Ресторан и магазин имеют разные категории товаров
- 🚫 Производство и торговля требуют разных полей
- 🚫 Невозможно добавить кастомные типы товаров (например, "готовые блюда", "ингредиенты", "упаковка")
- 🚫 Невозможно настроить структуру под специфику бизнеса

---

## 🎯 Целевая архитектура

### Концепция: Schema-Driven Inventory System

**Основная идея:** Каждая компания/группа имеет свою **схему номенклатуры**, которая определяет:
- Структуру категорий
- Типы товаров и их поля
- Правила валидации
- Бизнес-логику

---

## 📊 Архитектура решения

### 1. Модель данных

#### 1.1. Inventory Schema (Схема номенклатуры)

```typescript
interface InventorySchema {
  id: string                    // UUID схемы
  company_id: string           // ID компании (опционально, для глобальных схем)
  group_id?: string             // ID группы (если схема специфична для группы)
  name: string                 // Название схемы
  version: number              // Версия схемы
  is_default: boolean          // Схема по умолчанию для компании
  created_at: string
  updated_at: string
  
  // Структура схемы
  structure: {
    categories: CategoryDefinition[]    // Определения категорий
    item_types: ItemTypeDefinition[]     // Типы товаров
    fields: FieldDefinition[]            // Глобальные поля
    validation_rules: ValidationRule[]   // Правила валидации
  }
}
```

#### 1.2. Category Definition (Определение категории)

```typescript
interface CategoryDefinition {
  id: string                   // UUID категории в схеме
  name: string                 // Название категории
  display_name: string         // Отображаемое название
  icon?: string                // Иконка категории
  color?: string              // Цвет категории
  order: number               // Порядок отображения
  description?: string        // Описание категории
  
  // Настройки категории
  settings: {
    allow_custom_items: boolean    // Разрешить добавление кастомных товаров
    required_fields: string[]       // Обязательные поля для товаров в категории
    default_item_type: string       // Тип товара по умолчанию
  }
}
```

#### 1.3. Item Type Definition (Определение типа товара)

```typescript
interface ItemTypeDefinition {
  id: string                   // UUID типа товара
  name: string                 // Название типа (raw, semifinished, готовое_блюдо, etc.)
  display_name: string         // Отображаемое название
  icon?: string                // Иконка типа
  color?: string              // Цвет типа
  
  // Поля типа товара
  fields: FieldDefinition[]
  
  // Настройки типа
  settings: {
    can_have_quantity: boolean      // Может иметь количество
    can_have_expiry: boolean        // Может иметь срок годности
    can_be_out_of_stock: boolean   // Может быть "нет в наличии"
    requires_notes: boolean         // Требует заметки
    allow_multiple: boolean        // Может быть несколько экземпляров
  }
}
```

#### 1.4. Field Definition (Определение поля)

```typescript
interface FieldDefinition {
  id: string                   // UUID поля
  name: string                 // Название поля (quantity, expiry_date, etc.)
  display_name: string         // Отображаемое название
  type: FieldType              // Тип поля
  required: boolean            // Обязательное поле
  default_value?: any          // Значение по умолчанию
  
  // Настройки поля
  settings: {
    min?: number               // Минимальное значение (для чисел)
    max?: number               // Максимальное значение (для чисел)
    pattern?: string           // Регулярное выражение (для строк)
    options?: string[]         // Варианты выбора (для select)
    unit?: string              // Единица измерения (кг, л, шт)
    format?: string            // Формат (для дат)
  }
  
  // Валидация
  validation?: {
    rules: ValidationRule[]
    error_messages: Record<string, string>
  }
}

enum FieldType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  TEXTAREA = 'textarea',
  FILE = 'file',
  URL = 'url'
}
```

#### 1.5. Inventory Item (Динамический товар)

```typescript
interface InventoryItem {
  id: string                   // UUID товара
  name: string                 // Название товара
  category_id: string          // ID категории из схемы
  item_type_id: string         // ID типа товара из схемы
  schema_id: string           // ID схемы номенклатуры
  
  // Динамические поля (зависят от схемы)
  fields: Record<string, any>
  
  // Метаданные
  metadata: {
    created_at: string
    updated_at: string
    created_by: string
    updated_by: string
  }
  
  // История изменений
  history?: HistoryRecord[]
}
```

#### 1.6. Inventory Data (Динамические данные инвентаря)

```typescript
interface InventoryData {
  chat_id: string
  chat_title: string
  schema_id: string              // ID используемой схемы
  schema_version: number          // Версия схемы
  
  // Динамическая структура на основе схемы
  inventory: {
    [category_id: string]: {
      [item_id: string]: InventoryItem
    }
  }
  
  metadata: InventoryMetadata
}
```

---

### 2. База данных

#### 2.1. Новая таблица: `inventory_schemas`

```sql
CREATE TABLE inventory_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    group_id BIGINT REFERENCES groups(group_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_default BOOLEAN DEFAULT FALSE,
    structure JSONB NOT NULL,  -- Полная структура схемы
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, name, version),
    UNIQUE(group_id, name, version)
);

CREATE INDEX idx_inventory_schemas_company ON inventory_schemas(company_id);
CREATE INDEX idx_inventory_schemas_group ON inventory_schemas(group_id);
CREATE INDEX idx_inventory_schemas_default ON inventory_schemas(company_id, is_default) WHERE is_default = TRUE;
```

#### 2.2. Обновление таблицы: `groups`

```sql
-- Добавляем поле для связи со схемой
ALTER TABLE groups 
ADD COLUMN inventory_schema_id UUID REFERENCES inventory_schemas(id);

CREATE INDEX idx_groups_inventory_schema ON groups(inventory_schema_id);
```

#### 2.3. Миграция существующих данных

```sql
-- Создаем схему по умолчанию из текущего шаблона
INSERT INTO inventory_schemas (id, name, version, is_default, structure)
VALUES (
    gen_random_uuid(),
    'Default Restaurant Schema',
    1,
    TRUE,
    '{
        "categories": [...],
        "item_types": [
            {
                "id": "raw",
                "name": "raw",
                "display_name": "Сырье",
                "fields": [
                    {"id": "quantity", "type": "number", "required": true},
                    {"id": "filled", "type": "boolean", "required": true},
                    {"id": "isOutOfStock", "type": "boolean", "required": false},
                    {"id": "expiry_date", "type": "date", "required": false},
                    {"id": "notes", "type": "textarea", "required": false}
                ]
            },
            {
                "id": "semifinished",
                "name": "semifinished",
                "display_name": "Полуфабрикат",
                "fields": [...]
            }
        ]
    }'::jsonb
);

-- Привязываем существующие группы к схеме по умолчанию
UPDATE groups 
SET inventory_schema_id = (SELECT id FROM inventory_schemas WHERE is_default = TRUE LIMIT 1)
WHERE group_type = 'chef' AND inventory_schema_id IS NULL;
```

---

### 3. Backend API

#### 3.1. Endpoints для схем

**GET `/v1/inventory/schemas`**
- Получить список схем для компании/группы
- Query params: `company_id`, `group_id`
- Возвращает: `InventorySchema[]`

**GET `/v1/inventory/schemas/{schema_id}`**
- Получить схему по ID
- Возвращает: `InventorySchema`

**POST `/v1/inventory/schemas`**
- Создать новую схему
- Body: `CreateSchemaPayload`
- Возвращает: `InventorySchema`

**PUT `/v1/inventory/schemas/{schema_id}`**
- Обновить схему (создает новую версию)
- Body: `UpdateSchemaPayload`
- Возвращает: `InventorySchema`

**POST `/v1/inventory/schemas/{schema_id}/clone`**
- Клонировать схему
- Body: `{ name: string, company_id?: string, group_id?: string }`
- Возвращает: `InventorySchema`

**POST `/v1/inventory/groups/{group_id}/schema`**
- Привязать схему к группе
- Body: `{ schema_id: string }`
- Возвращает: `{ success: boolean }`

#### 3.2. Обновленные endpoints

**GET `/v1/inventory/{chat_id}`**
- Теперь возвращает данные с учетом схемы группы
- Автоматически применяет схему при загрузке

**POST `/v1/inventory/{chat_id}`**
- Валидация данных по схеме
- Проверка обязательных полей
- Применение правил валидации

---

### 4. Frontend архитектура

#### 4.1. Schema Provider

```typescript
// features/Inventory/contexts/SchemaContext.tsx
interface SchemaContextValue {
  schema: InventorySchema | null
  isLoading: boolean
  error: string | null
  reloadSchema: () => Promise<void>
}

export const SchemaProvider: React.FC<{ children: React.ReactNode }>
export const useSchema: () => SchemaContextValue
```

#### 4.2. Динамические компоненты

**SchemaRenderer**
```typescript
// features/Inventory/components/SchemaRenderer.tsx
interface SchemaRendererProps {
  schema: InventorySchema
  data: InventoryData
  onUpdate: (item: InventoryItem) => void
}

// Рендерит интерфейс на основе схемы
export const SchemaRenderer: React.FC<SchemaRendererProps>
```

**DynamicField**
```typescript
// features/Inventory/components/DynamicField.tsx
interface DynamicFieldProps {
  field: FieldDefinition
  value: any
  onChange: (value: any) => void
  error?: string
}

// Рендерит поле на основе его типа
export const DynamicField: React.FC<DynamicFieldProps>
```

**DynamicCategoryGrid**
```typescript
// features/Inventory/components/DynamicCategoryGrid.tsx
// Адаптирует CategoryGrid под схему
// Использует категории из схемы вместо хардкода
```

**DynamicItemEdit**
```typescript
// features/Inventory/components/DynamicItemEdit.tsx
// Адаптирует ItemEdit под схему
// Рендерит поля на основе типа товара из схемы
```

#### 4.3. Schema Builder (Админ-панель)

```typescript
// features/Inventory/admin/SchemaBuilder.tsx
// Визуальный редактор схем номенклатур
// Позволяет:
// - Создавать/редактировать категории
// - Создавать/редактировать типы товаров
// - Настраивать поля
// - Устанавливать правила валидации
```

---

### 5. Миграция существующей системы

#### 5.1. Этап 1: Поддержка обеих систем

**Backward compatibility:**
- Если у группы нет схемы → используем старый шаблон
- Если есть схема → используем новую систему
- Постепенная миграция групп

#### 5.2. Этап 2: Конвертация шаблона в схему

```typescript
// services/inventory/schemaConverter.ts
export function convertTemplateToSchema(
  template: Record<string, any>
): InventorySchema {
  // Конвертирует старый JSON шаблон в новую схему
  // Извлекает категории
  // Создает типы товаров (raw, semifinished)
  // Настраивает поля
}
```

#### 5.3. Этап 3: Миграция данных

```typescript
// services/inventory/dataMigrator.ts
export function migrateInventoryData(
  oldData: Record<string, any>,
  schema: InventorySchema
): InventoryData {
  // Конвертирует старые данные в новый формат
  // Маппит категории и товары
  // Преобразует поля
}
```

---

## 🎨 Примеры использования

### Пример 1: Ресторан (текущая система)

```json
{
  "schema": {
    "categories": [
      { "id": "vegetables", "name": "Овощи и фрукты" },
      { "id": "meat", "name": "Мясо и рыба" }
    ],
    "item_types": [
      {
        "id": "raw",
        "fields": ["quantity", "filled", "isOutOfStock", "expiry_date", "notes"]
      },
      {
        "id": "semifinished",
        "fields": ["quantity", "filled", "notes"]
      }
    ]
  }
}
```

### Пример 2: Магазин (новая система)

```json
{
  "schema": {
    "categories": [
      { "id": "groceries", "name": "Бакалея" },
      { "id": "dairy", "name": "Молочные продукты" },
      { "id": "frozen", "name": "Замороженные продукты" }
    ],
    "item_types": [
      {
        "id": "product",
        "fields": [
          "quantity", 
          "price", 
          "barcode", 
          "expiry_date", 
          "supplier",
          "location"
        ]
      }
    ]
  }
}
```

### Пример 3: Производство (кастомная система)

```json
{
  "schema": {
    "categories": [
      { "id": "raw_materials", "name": "Сырье" },
      { "id": "components", "name": "Компоненты" },
      { "id": "finished_products", "name": "Готовая продукция" }
    ],
    "item_types": [
      {
        "id": "raw_material",
        "fields": [
          "quantity",
          "unit", 
          "batch_number",
          "supplier",
          "certificate",
          "storage_conditions"
        ]
      },
      {
        "id": "component",
        "fields": [
          "quantity",
          "assembly_date",
          "quality_check",
          "inspector"
        ]
      },
      {
        "id": "finished_product",
        "fields": [
          "quantity",
          "production_date",
          "serial_number",
          "quality_grade"
        ]
      }
    ]
  }
}
```

---

## ✅ Преимущества новой архитектуры

### 1. Масштабируемость
- ✅ Каждая компания может иметь свою номенклатуру
- ✅ Легко добавлять новые типы товаров
- ✅ Гибкая структура категорий

### 2. Гибкость
- ✅ Настраиваемые поля для каждого типа товара
- ✅ Кастомные правила валидации
- ✅ Разные бизнес-логики для разных компаний

### 3. Расширяемость
- ✅ Легко добавлять новые типы полей
- ✅ Плагинная архитектура для кастомных типов
- ✅ API для интеграций

### 4. Удобство
- ✅ Визуальный редактор схем
- ✅ Клонирование схем
- ✅ Версионирование схем

---

## 🚀 План внедрения

### Фаза 1: Подготовка (2-3 недели)
- [ ] Создать модели данных для схем
- [ ] Создать миграции БД
- [ ] Конвертировать текущий шаблон в схему
- [ ] Создать базовые API endpoints

### Фаза 2: Backend (3-4 недели)
- [ ] Реализовать CRUD для схем
- [ ] Реализовать валидацию по схемам
- [ ] Обновить существующие endpoints
- [ ] Тестирование

### Фаза 3: Frontend (4-5 недель)
- [ ] Создать Schema Context
- [ ] Реализовать динамические компоненты
- [ ] Создать Schema Builder (админ-панель)
- [ ] Обновить существующие компоненты
- [ ] Тестирование

### Фаза 4: Миграция (2-3 недели)
- [ ] Миграция существующих данных
- [ ] Обучение пользователей
- [ ] Документация
- [ ] Поддержка

---

## 📝 Дополнительные возможности

### 1. Шаблоны схем
- Предустановленные схемы для разных типов бизнеса
- Ресторан, магазин, производство, склад

### 2. Импорт/экспорт схем
- Экспорт схемы в JSON
- Импорт схемы из JSON
- Обмен схемами между компаниями

### 3. Версионирование
- История изменений схем
- Откат к предыдущим версиям
- Миграция данных при обновлении схемы

### 4. Наследование схем
- Базовые схемы для компании
- Переопределение на уровне группы
- Каскадное применение изменений

---

## 🔒 Безопасность

### 1. Права доступа
- Только администраторы могут создавать/редактировать схемы
- Обычные пользователи только используют схемы
- Аудит изменений схем

### 2. Валидация
- Проверка схемы при создании
- Валидация данных по схеме
- Защита от некорректных данных

### 3. Изоляция данных
- Схемы изолированы по компаниям
- Невозможность доступа к схемам других компаний

---

*Документ описывает архитектуру для перехода от статичной к динамической системе номенклатур*

