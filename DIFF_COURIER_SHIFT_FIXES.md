# Диф: Исправления для записи курьеров на смены

## 🔧 Изменения

### 1. Frontend: Исправление определения shiftType из template.startTime

**Файл:** `frontend/src/features/courierSchedule/components/shift-panel/ShiftPanel.tsx`

**Строка:** 264

**БЫЛО:**
```typescript
const templateShiftType: 'day' | 'night' = template.startTime >= '12:00' ? 'night' : 'day';
```

**СТАНЕТ:**
```typescript
// Функция для парсинга времени в минуты для корректного сравнения
const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
};

// Определяем тип смены на основе времени начала шаблона
// day: 06:00 - 15:59, night: 16:00 - 05:59 (согласовано с бэкендом)
const getShiftTypeFromTime = (startTime: string): 'day' | 'night' => {
    const timeMinutes = parseTimeToMinutes(startTime);
    const sixAM = parseTimeToMinutes('06:00');
    const fourPM = parseTimeToMinutes('16:00');
    
    // Если время >= 16:00 или < 06:00, это ночная смена
    if (timeMinutes >= fourPM || timeMinutes < sixAM) {
        return 'night';
    }
    return 'day';
};

const templateShiftType: 'day' | 'night' = getShiftTypeFromTime(template.startTime);
```

---

### 2. Backend: Унифицированная функция определения shift_type

**Файл:** `backend/API server/api/v1/endpoints/shifts.py`

**Добавить функцию в начало файла (после импортов):**

```python
def determine_shift_type_from_time(start_time: time) -> str:
    """
    Определяет тип смены по времени начала.
    day: 06:00 - 15:59
    night: 16:00 - 05:59
    
    Согласовано с фронтендом и логикой миграции.
    """
    from datetime import time as time_class
    
    six_am = time_class(6, 0)
    four_pm = time_class(16, 0)
    
    if start_time >= four_pm or start_time < six_am:
        return 'night'
    return 'day'
```

**Строка:** 192

**БЫЛО:**
```python
effective_shift_type = 'night' if template.start_time >= datetime.strptime('12:00', '%H:%M').time() else 'day'
```

**СТАНЕТ:**
```python
effective_shift_type = determine_shift_type_from_time(template.start_time)
logger.info(f"[Create Shift] Template {shift_in.template_id} start_time={template.start_time}, auto-determined shift_type={effective_shift_type} (for backward compatibility)")
```

---

### 3. Backend: Валидация shift_type из запроса

**Файл:** `backend/API server/api/v1/endpoints/shifts.py`

**Строка:** 178-193

**БЫЛО:**
```python
effective_shift_type = shift_in.shift_type  # По умолчанию из запроса

if shift_in.template_id:
    from models.shift_template import ShiftTemplate
    template_result = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.id == shift_in.template_id)
    )
    template = template_result.scalar_one_or_none()
    if not template:
        logger.error(f"[Create Shift] Template {shift_in.template_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift template not found")
    
    # Определяем shift_type для обратной совместимости с фронтендом
    # Фронтенд группирует смены по dayShifts/nightShifts
    effective_shift_type = 'night' if template.start_time >= datetime.strptime('12:00', '%H:%M').time() else 'day'
    logger.info(f"[Create Shift] Template {shift_in.template_id} start_time={template.start_time}, auto-determined shift_type={effective_shift_type} (for backward compatibility)")
```

**СТАНЕТ:**
```python
effective_shift_type = shift_in.shift_type  # По умолчанию из запроса

if shift_in.template_id:
    from models.shift_template import ShiftTemplate
    template_result = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.id == shift_in.template_id)
    )
    template = template_result.scalar_one_or_none()
    if not template:
        logger.error(f"[Create Shift] Template {shift_in.template_id} not found.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shift template not found")
    
    # Определяем shift_type из шаблона
    template_shift_type = determine_shift_type_from_time(template.start_time)
    
    # Валидация: проверяем, что shift_type из запроса соответствует шаблону
    if shift_in.shift_type != template_shift_type:
        logger.warning(
            f"[Create Shift] Shift type mismatch: requested={shift_in.shift_type}, "
            f"template-based={template_shift_type} (start_time={template.start_time}). "
            f"Using template-based shift_type."
        )
    
    effective_shift_type = template_shift_type
    logger.info(
        f"[Create Shift] Template {shift_in.template_id} start_time={template.start_time}, "
        f"determined shift_type={effective_shift_type} (requested={shift_in.shift_type})"
    )
```

---

### 4. Frontend: Утилита для определения shiftType (опционально, для переиспользования)

**Файл:** `frontend/src/features/courierSchedule/utils/shiftTypeUtils.ts` (новый файл)

```typescript
/**
 * Утилиты для определения типа смены
 */

/**
 * Парсит строку времени в минуты для корректного сравнения
 * @param timeStr - Время в формате "HH:MM" или "HH:MM:SS"
 * @returns Количество минут с начала дня
 */
export const parseTimeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + (minutes || 0);
};

/**
 * Определяет тип смены на основе времени начала
 * day: 06:00 - 15:59
 * night: 16:00 - 05:59
 * 
 * Согласовано с бэкендом
 * @param startTime - Время начала смены в формате "HH:MM" или "HH:MM:SS"
 * @returns 'day' | 'night'
 */
export const getShiftTypeFromTime = (startTime: string): 'day' | 'night' => {
    const timeMinutes = parseTimeToMinutes(startTime);
    const sixAM = parseTimeToMinutes('06:00');
    const fourPM = parseTimeToMinutes('16:00');
    
    // Если время >= 16:00 или < 06:00, это ночная смена
    if (timeMinutes >= fourPM || timeMinutes < sixAM) {
        return 'night';
    }
    return 'day';
};
```

**Затем в ShiftPanel.tsx:**

```typescript
import { getShiftTypeFromTime } from '@features/courierSchedule/utils/shiftTypeUtils';

// ...
const templateShiftType: 'day' | 'night' = getShiftTypeFromTime(template.startTime);
```

---

## 📋 Сводка изменений

| Файл | Строка | Изменение | Критичность |
|------|--------|-----------|-------------|
| `ShiftPanel.tsx` | 264 | Исправить строковое сравнение времени | 🔴 Высокая |
| `shifts.py` | ~20 | Добавить функцию `determine_shift_type_from_time` | 🔴 Высокая |
| `shifts.py` | 192 | Использовать унифицированную функцию | 🔴 Высокая |
| `shifts.py` | 178-193 | Добавить валидацию shift_type | 🟡 Средняя |
| `shiftTypeUtils.ts` | новый | Создать утилиту для фронтенда | 🟢 Низкая |

---

## ✅ Тестирование после изменений

### Тест-кейсы:

1. **Шаблон с start_time = '08:00'**
   - Ожидается: `shift_type = 'day'`
   - Frontend и Backend должны совпадать

2. **Шаблон с start_time = '12:00'**
   - Ожидается: `shift_type = 'day'` (в диапазоне 06:00-15:59)
   - Frontend и Backend должны совпадать

3. **Шаблон с start_time = '16:00'**
   - Ожидается: `shift_type = 'night'`
   - Frontend и Backend должны совпадать

4. **Шаблон с start_time = '22:00'**
   - Ожидается: `shift_type = 'night'`
   - Frontend и Backend должны совпадать

5. **Шаблон с start_time = '05:00'**
   - Ожидается: `shift_type = 'night'` (< 06:00)
   - Frontend и Backend должны совпадать

6. **Несоответствие shift_type в запросе**
   - Frontend отправляет `shift_type='day'`, но шаблон имеет `start_time='18:00'`
   - Backend должен использовать правильный `shift_type='night'` и залогировать предупреждение

---

## 🎯 Приоритет исправлений

1. **КРИТИЧНО:** Исправить строковое сравнение на фронтенде
2. **КРИТИЧНО:** Унифицировать логику определения day/night
3. **ВАЖНО:** Добавить валидацию на бэкенде
4. **ЖЕЛАТЕЛЬНО:** Создать переиспользуемую утилиту

