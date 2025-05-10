# Интеграция настроек доступа к сменам с календарем

## Обзор

Данная интеграция позволяет использовать настройки доступа к сменам для определения доступных дат в календаре курьера. Она включает в себя следующие компоненты:

1. **Redux-хранилище** - для хранения и управления настройками доступа
2. **useAccessSettingsSync** - хук для синхронизации настроек с календарем
3. **isDateAvailable** - функция для проверки доступности даты
4. **calculateAvailableDates** - функция для расчета доступных дат

## Компоненты

### 1. Redux-хранилище

Настройки доступа хранятся в Redux-хранилище в slice `shiftsSlice`. Интерфейс `AccessSettings` содержит все необходимые параметры для настройки доступа к сменам.

### 2. Хук useAccessSettingsSync

Хук используется для синхронизации настроек доступа из Redux с компонентом календаря. Он отслеживает изменения настроек и обновляет календарь при их изменении.

```tsx
// Пример использования
import { useAccessSettingsSync } from './hooks/useAccessSettingsSync';

const MyComponent = () => {
  const refreshCalendar = () => {
    // Логика обновления календаря
  };
  
  const accessSettings = useAccessSettingsSync(refreshCalendar);
  
  // ...
};
```

### 3. Функция isDateAvailable

Функция проверяет, доступна ли указанная дата для записи на смену:

```tsx
// Пример использования
import { isDateAvailable } from './utils/dateUtils';

const date = new Date();
const userId = '123';
const isAvailable = isDateAvailable(date, userId);
```

### 4. Функция calculateAvailableDates

Функция вычисляет массив доступных дат на основе настроек из Redux:

```tsx
// Пример использования
import { calculateAvailableDates } from './utils/dateUtils';

const availableDates = calculateAvailableDates();
```

## Интеграция с существующим кодом

1. Компонент `CourierCalendar` использует `useAccessSettingsSync` для отслеживания изменений настроек
2. Компонент `MonthSection` получает настройки доступа и передает их в `DayCell`
3. Функция `isDateAvailable` используется для определения, можно ли выбрать дату в календаре

## Обновление настроек

1. Настройки доступа обновляются в `ShiftAccessModal` при сохранении изменений
2. При изменении настроек, хук `useAccessSettingsSync` вызывает обновление календаря
3. Функция `isDateAvailable` автоматически учитывает новые настройки при проверке дат 