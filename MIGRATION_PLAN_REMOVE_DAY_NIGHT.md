# План миграции: Удаление day/night, переход на шаблоны

## 📋 Текущее состояние

### Что есть сейчас:
1. **БД:** Смены привязаны к шаблонам через `template_id` ✅
2. **Бэкенд:** Проверка слотов идет по `template_id` ✅
3. **Бэкенд:** `shift_type` все еще сохраняется (для обратной совместимости) ⚠️
4. **Фронтенд:** Группирует смены по `dayShifts`/`nightShifts` (через `shift_type`) ❌
5. **Фронтенд:** Потом фильтрует по `template_id` для отображения ⚠️

### Проблема:
Двойная группировка: сначала по `shift_type` (day/night), потом по `template_id`. Это избыточно и создает проблемы.

---

## 🎯 Цель миграции

**Полностью убрать day/night, группировать смены только по шаблонам.**

---

## 📝 План изменений

### Этап 1: Фронтенд - Группировка по шаблонам

#### 1.1. Изменить `useCalendarData.ts`
- ❌ Убрать `getDayShifts()` и `getNightShifts()`
- ✅ Добавить `getShiftsByTemplate(date, templateId)`
- ✅ Добавить `getAllShiftsForDate(date)` - все смены для даты

#### 1.2. Изменить `ShiftPanel.tsx`
- ❌ Убрать пропсы `dayShifts`, `nightShifts`, `maxDaySlots`, `maxNightSlots`
- ✅ Принимать `shifts: CourierShift[]` (все смены для даты)
- ✅ Группировать смены по `template_id` внутри компонента
- ❌ Убрать логику определения `templateShiftType` из `startTime`
- ✅ Использовать только `template_id` для группировки

#### 1.3. Изменить `CourierSelectionDialog.tsx`
- ❌ Убрать пропсы `dayShifts`, `nightShifts`
- ✅ Принимать `shifts: CourierShift[]`
- ✅ Передавать `shifts` в `ShiftPanel`

#### 1.4. Изменить `courier-calendar/index.tsx`
- ❌ Убрать `getDayShifts`, `getNightShifts`
- ✅ Использовать `getAllShiftsForDate`
- ✅ Передавать все смены в `ShiftSelectionDialog`

#### 1.5. Обновить другие компоненты
- `month-section/index.tsx` - убрать `getDayShifts`/`getNightShifts`
- `day-cell/index.tsx` - убрать `getDayShifts`/`getNightShifts`
- `ReservePanel.tsx` - убрать `dayShifts`/`nightShifts`

#### 1.6. Изменить `onSlotSelect` сигнатуру
- ❌ Убрать параметр `shiftType: 'day' | 'night'`
- ✅ Использовать только `templateId` и `slotIndex`

---

### Этап 2: Бэкенд - Убрать shift_type

#### 2.1. Создать миграцию БД
- Сделать `shift_type` nullable в таблице `shifts`
- Обновить существующие записи (если нужно)

#### 2.2. Изменить модель `Shift`
- `shift_type` сделать `nullable=True`

#### 2.3. Изменить `shifts.py`
- ❌ Убрать логику определения `effective_shift_type` из `template.start_time`
- ❌ Убрать сохранение `shift_type` при создании смены с `template_id`
- ✅ Сохранять `shift_type=None` для новых смен с шаблонами
- ⚠️ Оставить `shift_type` только для старых смен без `template_id` (обратная совместимость)

#### 2.4. Изменить схему `ShiftCreateTelegram`
- `shift_type` сделать `Optional[str] = None`
- Если передан `template_id`, `shift_type` не обязателен

#### 2.5. Обновить другие эндпоинты
- `update_shift_slot` - убрать `target_shift_type`
- `assign_shift` - убрать `shift_type` из запроса

---

### Этап 3: Типы и интерфейсы

#### 3.1. Frontend типы
- `CourierShift.shiftType` сделать `Optional<'day' | 'night'>`
- `ApiShift.shift_type` сделать `Optional<'day' | 'night'>`
- Обновить все места, где используется `shiftType`

#### 3.2. Backend схемы
- `ShiftRead.shift_type` сделать `Optional[str]`

---

## 🔄 Порядок выполнения

1. **Фронтенд** (можно делать параллельно):
   - Изменить `useCalendarData.ts`
   - Изменить `ShiftPanel.tsx`
   - Обновить все компоненты, использующие dayShifts/nightShifts
   - Обновить типы

2. **Бэкенд**:
   - Создать миграцию БД
   - Изменить модель
   - Обновить логику создания смен
   - Обновить схемы

3. **Тестирование**:
   - Проверить создание смен
   - Проверить отображение смен
   - Проверить группировку по шаблонам
   - Проверить обратную совместимость со старыми сменами

---

## ⚠️ Важные моменты

1. **Обратная совместимость:** Старые смены без `template_id` должны продолжать работать
2. **Миграция данных:** Возможно, нужно обновить старые смены, добавив им `template_id`
3. **Постепенный переход:** Можно сделать `shift_type` nullable сначала, потом убрать использование

---

## 📊 Файлы для изменения

### Frontend:
- `useCalendarData.ts` - убрать getDayShifts/getNightShifts
- `ShiftPanel.tsx` - группировка по шаблонам
- `CourierSelectionDialog.tsx` - убрать dayShifts/nightShifts
- `courier-calendar/index.tsx` - обновить использование
- `month-section/index.tsx` - обновить
- `day-cell/index.tsx` - обновить
- `ReservePanel.tsx` - обновить
- `types/courierScheduleTypes.ts` - обновить типы
- `shiftsThunks.ts` - убрать shiftType из bookShift

### Backend:
- `models/shift.py` - сделать shift_type nullable
- `api/v1/endpoints/shifts.py` - убрать логику shift_type
- `schemas/shift.py` - обновить схемы
- Создать миграцию Alembic

