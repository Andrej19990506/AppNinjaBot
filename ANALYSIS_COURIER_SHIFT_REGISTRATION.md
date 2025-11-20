# Анализ системы записи курьеров на смены (переход на шаблоны)

## 📋 Текущая архитектура

### 1. Поток данных при записи курьера

```
Frontend (ShiftPanel.tsx)
  ↓
Определение shiftType из template.startTime (строка 264)
  ↓
onSlotSelect(templateShiftType, slotIndex, ..., template.id)
  ↓
CourierSchedule.tsx → handleShiftSelect()
  ↓
bookShift({ shiftType, templateId, ... })
  ↓
API: POST /api/v1/shifts
  ↓
Backend (shifts.py: create_shift)
  ↓
Переопределение shift_type из template.start_time (строка 192)
  ↓
Создание Shift в БД
```

### 2. Ключевые компоненты

#### Frontend:
- **ShiftPanel.tsx:264** - Определение `templateShiftType` из `template.startTime`
- **CourierSchedule.tsx:201** - Обработчик `handleShiftSelect`
- **shiftsThunks.ts:76** - Thunk `bookShift` отправляет данные в API

#### Backend:
- **shifts.py:192** - Переопределение `effective_shift_type` из `template.start_time`
- **shifts.py:258-279** - Проверка занятости слота (по `template_id` или `shift_type`)
- **shifts.py:323-340** - Поиск занятых слотов

---

## 🐛 Обнаруженные проблемы

### ПРОБЛЕМА #1: Несоответствие логики определения day/night

**Место:** 
- Frontend: `ShiftPanel.tsx:264`
- Backend: `shifts.py:192`

**Проблема:**
```typescript
// FRONTEND (НЕПРАВИЛЬНО - строковое сравнение!)
const templateShiftType: 'day' | 'night' = template.startTime >= '12:00' ? 'night' : 'day';
```

```python
# BACKEND (Может быть неправильно для граничных случаев)
effective_shift_type = 'night' if template.start_time >= datetime.strptime('12:00', '%H:%M').time() else 'day'
```

**Примеры проблем:**
1. `template.startTime = '09:00'` → Frontend: `'day'` ✅, Backend: `'day'` ✅
2. `template.startTime = '12:00'` → Frontend: `'night'` ❌, Backend: `'night'` ❌ (может быть неправильно)
3. `template.startTime = '11:59'` → Frontend: `'day'` ✅, Backend: `'day'` ✅
4. `template.startTime = '12:01'` → Frontend: `'night'` ✅, Backend: `'night'` ✅
5. `template.startTime = '09:00'` → Строковое сравнение `'09:00' >= '12:00'` = `false` ✅ (работает случайно)
6. `template.startTime = '13:00'` → Строковое сравнение `'13:00' >= '12:00'` = `true` ✅ (работает случайно)

**Критичность:** 🔴 ВЫСОКАЯ - может привести к неправильной группировке смен

---

### ПРОБЛЕМА #2: Переопределение shift_type на бэкенде игнорирует данные фронтенда

**Место:** `shifts.py:178-193`

**Проблема:**
```python
effective_shift_type = shift_in.shift_type  # Берем из запроса
if shift_in.template_id:
    # ... загружаем template ...
    # ПЕРЕОПРЕДЕЛЯЕМ, игнорируя shift_in.shift_type!
    effective_shift_type = 'night' if template.start_time >= datetime.strptime('12:00', '%H:%M').time() else 'day'
```

**Сценарий проблемы:**
1. Frontend определяет `shiftType = 'day'` (может быть неправильно из-за строкового сравнения)
2. Frontend отправляет `{ shift_type: 'day', template_id: '...' }`
3. Backend **игнорирует** `shift_type` из запроса и переопределяет его
4. Если логика определения разная → несоответствие

**Критичность:** 🟡 СРЕДНЯЯ - может привести к несоответствию данных

---

### ПРОБЛЕМА #3: Смешанная логика проверки слотов

**Место:** `shifts.py:258-279, 323-340`

**Проблема:**
Код проверяет занятость слотов по-разному:
- Если есть `template_id` → проверка по `template_id`
- Если нет `template_id` → проверка по `shift_type`

**Потенциальная проблема:**
Если фронтенд отправит `template_id` + `shift_type`, но бэкенд переопределит `shift_type`, может возникнуть конфликт при проверке слотов.

**Критичность:** 🟡 СРЕДНЯЯ - может привести к дублированию записей

---

### ПРОБЛЕМА #4: Нет единой точки определения day/night

**Проблема:**
Логика определения day/night разбросана:
- Frontend: `ShiftPanel.tsx:264`
- Backend: `shifts.py:192`
- Migration: `000037_migrate_shifts_to_templates.py:240-252` (использует `06:00-16:00` для day)

**Разные пороги:**
- Frontend/Backend: `>= 12:00` = night
- Migration: `06:00-16:00` = day, `>= 16:00 OR < 06:00` = night

**Критичность:** 🟡 СРЕДНЯЯ - несоответствие в разных частях системы

---

## 📊 Сравнительная таблица логики определения day/night

| Компонент | Порог | Логика | Проблема |
|-----------|-------|--------|----------|
| **Frontend (ShiftPanel.tsx:264)** | `>= '12:00'` | Строковое сравнение | ❌ Ненадежно |
| **Backend (shifts.py:192)** | `>= 12:00` | Сравнение времени | ⚠️ Граничный случай 12:00 |
| **Migration (000037:240-252)** | `06:00-16:00` / `>= 16:00` | Диапазоны | ⚠️ Другая логика |

---

## 🔍 Детальный анализ потока записи

### Шаг 1: Frontend определяет shiftType
```typescript
// ShiftPanel.tsx:264
const templateShiftType: 'day' | 'night' = template.startTime >= '12:00' ? 'night' : 'day';
```
**Проблема:** Строковое сравнение может работать неправильно для форматов типа `'9:00'` vs `'12:00'`

### Шаг 2: Frontend отправляет запрос
```typescript
// shiftsThunks.ts:78-84
const apiData = {
    shift_type: shiftType,  // Может быть неправильным из-за строкового сравнения
    template_id: templateId || null,
    // ...
};
```

### Шаг 3: Backend переопределяет shift_type
```python
# shifts.py:178-193
effective_shift_type = shift_in.shift_type  # Игнорируется дальше!
if shift_in.template_id:
    # Переопределяем, игнорируя shift_in.shift_type
    effective_shift_type = 'night' if template.start_time >= datetime.strptime('12:00', '%H:%M').time() else 'day'
```

### Шаг 4: Проверка занятости слота
```python
# shifts.py:258-279
if shift_in.template_id:
    # Проверка по template_id
    requested_slot_stmt = select(Shift.id).where(
        Shift.template_id == shift_in.template_id,
        Shift.slot_index == shift_in.slot_index
    )
else:
    # Проверка по shift_type (старая логика)
    requested_slot_stmt = select(Shift.id).where(
        Shift.shift_type == shift_in.shift_type,
        Shift.slot_index == shift_in.slot_index
    )
```

---

## 💡 Рекомендации по исправлению

### 1. Унифицировать логику определения day/night

**Вариант A:** Использовать единую функцию на бэкенде
```python
def determine_shift_type_from_time(start_time: time) -> str:
    """
    Определяет тип смены по времени начала.
    day: 06:00 - 15:59
    night: 16:00 - 05:59
    """
    if start_time >= time(16, 0) or start_time < time(6, 0):
        return 'night'
    return 'day'
```

**Вариант B:** Хранить shift_type в шаблоне
Добавить поле `shift_type` в модель `ShiftTemplate` и определять при создании шаблона.

### 2. Исправить строковое сравнение на фронтенде

```typescript
// Вместо строкового сравнения
const templateShiftType: 'day' | 'night' = template.startTime >= '12:00' ? 'night' : 'day';

// Использовать парсинг времени
const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const templateShiftType: 'day' | 'night' = 
    parseTime(template.startTime) >= parseTime('12:00') ? 'night' : 'day';
```

### 3. Убрать переопределение shift_type на бэкенде

Если фронтенд правильно определяет shift_type, бэкенд должен его использовать, а не переопределять.

### 4. Добавить валидацию

Проверять, что `shift_type` из запроса соответствует `template.start_time`.

---

## 📝 Следующие шаги

1. ✅ Анализ завершен
2. ⏳ Ожидание решения о подходе к исправлению
3. ⏳ Реализация исправлений
4. ⏳ Тестирование

