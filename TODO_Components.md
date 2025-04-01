# Список компонентов и необходимых изменений

## reservesSlice.ts

### Текущее состояние
- Слайс для управления резервами курьеров
- Использует временные заглушки для WebSocket функционала

### Временная заглушка socketService
```typescript
const socketService = {
    isConnected: () => false,
    subscribe: (event: string, callback: Function) => {
        console.log('🔄 [socketService] Подписка временно недоступна');
        return () => console.log('🧹 [socketService] Отписка временно недоступна');
    },
    unsubscribe: (event: string) => {
        console.log(`🔄 [socketService] Отписка от события ${event} временно недоступна`);
    },
    emit: (event: string, data?: any) => {
        console.log(`🔄 [socketService] Отправка события ${event} временно недоступна`);
    },
    off: (event: string, callback?: Function) => {
        console.log(`🔄 [socketService] Отписка от события ${event} временно недоступна`);
    }
};
```

### Временная заглушка websocketHelper
```typescript
const subscribeToEvent = (event: string, callback: Function) => {
    console.log(`🔄 [websocketHelper] Подписка на событие ${event} временно недоступна`);
    return () => console.log(`🧹 [websocketHelper] Отписка от события ${event} временно недоступна`);
};

const unsubscribeFromEvent = (event: string, callback: Function) => {
    console.log(`🔄 [websocketHelper] Отписка от события ${event} временно недоступна`);
};
```

### Необходимые изменения для reservesSlice
1. Создать полноценный сервис сокетов со следующими методами:
   - `isConnected(): boolean` - проверка состояния подключения
   - `subscribe(event: string, callback: Function): () => void` - подписка на события
   - `unsubscribe(event: string): void` - отписка от событий
   - `emit(event: string, data?: any): void` - отправка событий
   - `off(event: string, callback?: Function): void` - отписка от событий

2. Реализовать обработку WebSocket событий:
   - `reserve_added` - добавление резерва
   - `reserve_deleted` - удаление резерва
   - `reserve_update` - обновление резерва
   - `reserve_update_all` - массовое обновление резервов

3. Добавить типизацию для всех событий и данных:
```typescript
interface ReserveEvent {
    reserve_added: IncomingReserveData;
    reserve_deleted: { id?: string; userId?: string; date?: string };
    reserve_update: IncomingReserveData;
    reserve_update_all: { reserves: IncomingReserveData[] };
}
```

## ShiftPanelContainer.tsx

### Текущее состояние
- Компонент отвечает за отображение и управление сменами курьеров
- Использует временную заглушку для WebSocket функционала

### Временная заглушка useWebSocket
```typescript
const useWebSocket = (chatId?: string) => ({
    isConnected: false,
    connect: () => console.log('🔄 [useWebSocket] Подключение временно недоступно'),
    disconnect: () => console.log('🔄 [useWebSocket] Отключение временно недоступно'),
    subscribe: () => {
        console.log('🔄 [useWebSocket] Подписка временно недоступна');
        return () => console.log('🧹 [useWebSocket] Отписка временно недоступна');
    },
    joinShiftsRoom: (chatId: string) => {
        console.log('🔄 [useWebSocket] Присоединение к комнате смен временно недоступно');
    }
});
```

## hooks/useWebSocket.ts

### Текущее состояние
- Создана базовая структура хука
- Реализована временная заглушка с основными методами
- Добавлена базовая типизация

### Временная реализация
```typescript
interface WebSocketHook {
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    subscribe: (event: string, callback: Function) => () => void;
    joinShiftsRoom: (chatId: string) => void;
}

export const useWebSocket = (chatId?: string): WebSocketHook => {
    const [isConnected, setIsConnected] = useState(false);
    // ... методы с заглушками ...
    return {
        isConnected,
        connect,
        disconnect,
        subscribe,
        joinShiftsRoom
    };
};
```

### Следующие шаги
1. [x] Создать файл `hooks/useWebSocket.ts`
2. [ ] Реализовать реальное WebSocket подключение
3. [ ] Добавить обработку событий
4. [ ] Реализовать механизм переподключения
5. [ ] Добавить обработку ошибок

## useAvailabilityCheck.ts

### Текущее состояние
- Хук для проверки доступности и обновления календаря
- Использует временные заглушки для WebSocket функционала и сервиса сокетов

### Временная заглушка socketService
```typescript
const socketService = {
    isConnected: () => false,
    connect: () => Promise.resolve(),
    joinCourierRoom: (chatId: string, userData: any) => {
        console.log('🔄 [socketService] Присоединение к комнате курьеров временно недоступно');
    },
    on: (event: string, callback: Function) => {
        console.log(`🔄 [socketService] Подписка на событие ${event} временно недоступна`);
    },
    off: (event: string, callback: Function) => {
        console.log(`🔄 [socketService] Отписка от события ${event} временно недоступна`);
    }
};
```

### Временная заглушка useWebSocketConnection
```typescript
const useWebSocketConnection = () => ({
    isConnected: false,
    connect: () => console.log('🔄 [useWebSocketConnection] Подключение временно недоступно'),
    disconnect: () => console.log('🔄 [useWebSocketConnection] Отключение временно недоступно'),
    subscribe: () => {
        console.log('🔄 [useWebSocketConnection] Подписка временно недоступна');
        return () => console.log('🧹 [useWebSocketConnection] Отписка временно недоступна');
    }
});
```

### Необходимые изменения для useAvailabilityCheck
1. Создать полноценный сервис сокетов со следующими методами:
   - `isConnected(): boolean` - проверка состояния подключения
   - `connect(): Promise<void>` - установка соединения
   - `joinCourierRoom(chatId: string, userData: any): void` - присоединение к комнате курьеров
   - `on(event: string, callback: Function): void` - подписка на события
   - `off(event: string, callback: Function): void` - отписка от событий

2. Реализовать обработку WebSocket событий:
   - `availability_update` - обновление доступности дат
   - `refresh_calendar` - команда обновления календаря
   - `global_refresh` - глобальное обновление
   - `error` - обработка ошибок

3. Добавить типизацию для всех событий и данных:
```typescript
interface WebSocketEvent {
    availability_update: AvailabilityUpdate;
    refresh_calendar: any;
    global_refresh: any;
    error: Error;
}
```

### Приоритетные задачи
1. [ ] Создать реальный сервис сокетов
2. [ ] Реализовать подключение к комнате курьеров
3. [ ] Добавить обработку всех событий
4. [ ] Реализовать механизм переподключения
5. [ ] Добавить обработку ошибок
6. [ ] Объединить дублирующиеся заглушки в один модуль

### Зависимости
- socket.io-client
- typescript
- react
- redux
- @reduxjs/toolkit

### Примечания
- Необходимо обеспечить стабильное соединение с автоматическим переподключением
- Добавить логирование всех WebSocket операций
- Реализовать механизм очистки ресурсов при размонтировании компонентов
- Обеспечить типобезопасность для всех событий и данных
- Объединить все заглушки в единый модуль для упрощения поддержки

### Необходимые изменения
1. Создать полноценный хук useWebSocket со следующими методами:
   - `isConnected`: boolean - флаг состояния подключения
   - `connect(): void` - метод для установки соединения
   - `disconnect(): void` - метод для разрыва соединения
   - `subscribe(event: string, callback: Function): () => void` - метод для подписки на события
   - `joinShiftsRoom(chatId: string): void` - метод для присоединения к комнате смен

2. Добавить обработку WebSocket событий:
   - Подключение к комнате смен при монтировании компонента
   - Отключение от комнаты при размонтировании
   - Обработка событий обновления смен
   - Обработка ошибок соединения

3. Реализовать типы данных:
```typescript
interface WebSocketHook {
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    subscribe: (event: string, callback: Function) => () => void;
    joinShiftsRoom: (chatId: string) => void;
}
```

### Приоритетные задачи
1. [ ] Создать файл `hooks/useWebSocket.ts`
2. [ ] Реализовать базовое WebSocket подключение
3. [ ] Добавить систему событий
4. [ ] Реализовать механизм переподключения
5. [ ] Добавить обработку ошибок

### Зависимости
- socket.io-client
- typescript
- react

### Примечания
- Необходимо обеспечить стабильное соединение с автоматическим переподключением
- Добавить логирование всех WebSocket операций
- Реализовать механизм очистки ресурсов при размонтировании компонента 