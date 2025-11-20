# 🚀 План реализации максимально производительного QR-сканера

## 📋 Цель

Создать QR-сканер для React Native, который по скорости и точности не уступает:
- ТСД (Терминал сбора данных)
- Приложению "Честный знак"
- Профессиональным сканерам штрих-кодов

**Целевые показатели:**
- ⚡ Скорость распознавания: < 100ms
- 🎯 Точность: > 99%
- 📱 Поддержка всех типов устройств (включая старые)
- 🔋 Оптимизация энергопотребления

---

## 🔍 Анализ лучших библиотек (2024)

### 1. react-native-vision-camera + vision-camera-code-scanner ⭐ **РЕКОМЕНДУЕТСЯ**

**Преимущества:**
- ✅ **Самая быстрая** библиотека для React Native
- ✅ Использует нативные API (AVFoundation на iOS, CameraX на Android)
- ✅ Поддержка ML Kit Barcode Scanner (Google) - самый быстрый декодер
- ✅ Низкая задержка (low latency)
- ✅ Поддержка всех типов штрих-кодов
- ✅ Отличная производительность на старых устройствах
- ✅ Активная разработка и поддержка

**Производительность:**
- iOS: AVFoundation (нативный) - ~50-100ms
- Android: ML Kit Barcode Scanner - ~50-150ms
- Frame processing: 30-60 FPS

**Установка:**
```bash
npm install react-native-vision-camera
npm install vision-camera-code-scanner
```

**Требования:**
- iOS 11.0+
- Android 21+ (API level 21)
- React Native 0.64+

### 2. react-native-camera (устаревшая)

**Недостатки:**
- ❌ Устаревшая библиотека (deprecated)
- ❌ Медленнее чем vision-camera
- ❌ Проблемы с производительностью
- ❌ Не рекомендуется для новых проектов

### 3. expo-camera (если используется Expo)

**Особенности:**
- ✅ Хорошая производительность
- ✅ Простая интеграция
- ⚠️ Требует Expo SDK
- ⚠️ Медленнее чем vision-camera

---

## 🏗️ Архитектура решения

### Выбранная библиотека: **react-native-vision-camera + vision-camera-code-scanner**

**Почему:**
1. Максимальная производительность (нативные API)
2. ML Kit Barcode Scanner - самый быстрый декодер от Google
3. Поддержка всех платформ
4. Активная разработка

---

## 📐 Техническая архитектура

### Компоненты системы

```
QRScannerScreen
├── CameraView (react-native-vision-camera)
│   ├── Frame Processor (vision-camera-code-scanner)
│   ├── Auto Focus Manager
│   └── Torch Controller
├── ScannerOverlay (UI overlay)
│   ├── Reticle (рамка сканирования)
│   ├── Scan Beam (анимация)
│   └── Status Indicator
├── Performance Optimizer
│   ├── Frame Rate Controller
│   ├── Region of Interest (ROI)
│   └── Debounce Handler
└── Result Handler
    ├── Validation
    ├── Audio Feedback
    └── Haptic Feedback
```

---

## ⚙️ Оптимизации производительности

### 1. Настройки камеры

**iOS (AVFoundation):**
```typescript
{
  device: backCamera, // Задняя камера
  fps: 60, // Максимальный FPS для быстрого сканирования
  videoHdr: false, // Отключаем HDR для скорости
  videoStabilizationMode: 'off', // Отключаем стабилизацию
  format: highestResolutionFormat, // Максимальное разрешение
  pixelFormat: 'yuv', // YUV для быстрой обработки
  enableBufferCompression: false, // Отключаем сжатие
  enableDepthData: false, // Не нужны данные глубины
}
```

**Android (CameraX):**
```typescript
{
  device: backCamera,
  fps: 60,
  videoHdr: false,
  format: highestResolutionFormat,
  pixelFormat: 'yuv',
  enableBufferCompression: false,
}
```

### 2. Frame Processor оптимизация

**Region of Interest (ROI):**
- Обрабатывать только центральную область (60-80% экрана)
- Уменьшает нагрузку на CPU/GPU
- Ускоряет распознавание на 30-50%

**Frame Rate:**
- Максимальный FPS: 60 (если поддерживается)
- Минимальный FPS: 30 (для старых устройств)
- Адаптивный FPS в зависимости от устройства

**Debounce:**
- Задержка между распознаваниями: 100-200ms
- Предотвращает множественные срабатывания
- Улучшает UX

### 3. ML Kit Barcode Scanner настройки

**Android:**
```typescript
{
  barcodeFormats: [BarcodeFormat.QR_CODE], // Только QR для скорости
  enableAllPotentialBarcodes: false, // Только уверенные результаты
}
```

**iOS:**
```typescript
{
  symbologies: [.qr], // Только QR
  // AVFoundation автоматически оптимизирован
}
```

### 4. Auto Focus оптимизация

**Стратегия:**
- Continuous autofocus при запуске
- Tap-to-focus для ручной настройки
- Interval focus каждые 2-3 секунды
- Отключение при успешном распознавании

**Реализация:**
```typescript
// Continuous autofocus
camera.setFocusMode('continuous');

// Tap-to-focus
onTap: (point) => {
  camera.setFocusPoint(point);
  camera.setFocusMode('single-shot');
}
```

### 5. Память и ресурсы

**Оптимизации:**
- Очистка буферов после обработки
- Минимизация аллокаций в frame processor
- Использование native buffers
- Отключение ненужных функций камеры

---

## 🎯 Реализация компонентов

### 1. QRScannerScreen

**Структура:**
```typescript
interface QRScannerScreenProps {
  onCodeDetected: (code: string) => void;
  onClose: () => void;
  enableTorch?: boolean;
  enableVibration?: boolean;
  enableSound?: boolean;
  scanRegion?: { x: number; y: number; width: number; height: number };
}
```

**Функционал:**
- Управление камерой
- Обработка результатов
- UI overlay
- Обработка ошибок

### 2. Frame Processor

**Оптимизированный обработчик:**
```typescript
const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  
  // ROI - обрабатываем только центральную область
  const roi = {
    x: frame.width * 0.1,
    y: frame.height * 0.1,
    width: frame.width * 0.8,
    height: frame.height * 0.8,
  };
  
  // Сканирование с ML Kit
  const codes = scanCodes(frame, {
    regionOfInterest: roi,
    formats: ['qr'],
  });
  
  if (codes.length > 0) {
    runOnJS(onCodeDetected)(codes[0].value);
  }
}, []);
```

### 3. Performance Monitor

**Мониторинг производительности:**
- FPS камеры
- Время обработки кадра
- Время распознавания
- Использование памяти
- Температура устройства

---

## 📱 UI/UX компоненты

### 1. ScannerOverlay

**Элементы:**
- Рамка сканирования (reticle)
- Анимация сканирующей линии
- Индикатор фокуса
- Индикатор состояния (поиск/найдено/ошибка)

**Анимации:**
- Плавная анимация сканирующей линии
- Пульсация при фокусировке
- Успешное распознавание (зеленая рамка + вибрация)

### 2. Controls

**Кнопки:**
- Закрыть
- Фонарик (torch)
- Переключение камеры (если доступно)
- Настройки (опционально)

### 3. Feedback

**Обратная связь:**
- Звуковой сигнал при успешном сканировании
- Вибрация (haptic feedback)
- Визуальная анимация успеха
- Статус сообщения

---

## 🔧 Технические детали реализации

### 1. Установка зависимостей

```bash
# Основные библиотеки
npm install react-native-vision-camera
npm install vision-camera-code-scanner

# Для работы с нативным кодом
npm install react-native-worklets-core

# Для вибрации
npm install react-native-haptic-feedback

# Для звука (опционально)
npm install react-native-sound
```

### 2. Настройка permissions

**iOS (Info.plist):**
```xml
<key>NSCameraUsageDescription</key>
<string>Для сканирования QR-кодов требуется доступ к камере</string>
```

**Android (AndroidManifest.xml):**
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
```

### 3. Настройка камеры

**Инициализация:**
```typescript
const devices = useCameraDevices();
const device = devices.back; // Задняя камера

const camera = useCamera(device, {
  fps: 60,
  videoHdr: false,
  videoStabilizationMode: 'off',
  format: device.formats.find(f => f.videoWidth >= 1920),
});
```

### 4. Frame Processor

**Оптимизированный код:**
```typescript
import { useFrameProcessor } from 'react-native-vision-camera';
import { scanCodes } from 'vision-camera-code-scanner';

const frameProcessor = useFrameProcessor((frame) => {
  'worklet';
  
  // ROI для оптимизации
  const roi = {
    x: Math.floor(frame.width * 0.1),
    y: Math.floor(frame.height * 0.1),
    width: Math.floor(frame.width * 0.8),
    height: Math.floor(frame.height * 0.8),
  };
  
  try {
    const codes = scanCodes(frame, {
      regionOfInterest: roi,
      formats: ['qr'],
      checkInverted: false, // Отключаем для скорости
    });
    
    if (codes.length > 0 && codes[0].value) {
      const code = codes[0].value;
      runOnJS(handleCodeDetected)(code);
    }
  } catch (error) {
    // Ошибки обрабатываем тихо для производительности
  }
}, []);
```

### 5. Debounce и обработка результатов

```typescript
const lastDetectedCodeRef = useRef<string | null>(null);
const lastDetectionTimeRef = useRef<number>(0);
const DEBOUNCE_MS = 200; // 200ms задержка

const handleCodeDetected = useCallback((code: string) => {
  const now = Date.now();
  
  // Debounce: игнорируем повторные срабатывания
  if (
    lastDetectedCodeRef.current === code &&
    now - lastDetectionTimeRef.current < DEBOUNCE_MS
  ) {
    return;
  }
  
  lastDetectedCodeRef.current = code;
  lastDetectionTimeRef.current = now;
  
  // Обработка результата
  onCodeDetected(code);
  
  // Feedback
  HapticFeedback.trigger('impactMedium');
  playSuccessSound();
}, [onCodeDetected]);
```

---

## 🎨 UI компоненты

### 1. ScannerOverlay

```typescript
interface ScannerOverlayProps {
  scanning: boolean;
  detected: boolean;
  error?: string;
}

const ScannerOverlay: React.FC<ScannerOverlayProps> = ({
  scanning,
  detected,
  error,
}) => {
  return (
    <View style={styles.overlay}>
      {/* Рамка сканирования */}
      <View style={styles.reticle}>
        <Animated.View 
          style={[
            styles.scanLine,
            scanning && styles.scanLineAnimated
          ]} 
        />
      </View>
      
      {/* Индикатор состояния */}
      <View style={styles.statusIndicator}>
        {detected && <SuccessIcon />}
        {error && <ErrorIcon />}
        {scanning && <ScanningIcon />}
      </View>
    </View>
  );
};
```

### 2. Controls

```typescript
const ScannerControls: React.FC<{
  onClose: () => void;
  onTorchToggle: () => void;
  torchEnabled: boolean;
  canUseTorch: boolean;
}> = ({ onClose, onTorchToggle, torchEnabled, canUseTorch }) => {
  return (
    <View style={styles.controls}>
      <Pressable onPress={onClose} style={styles.closeButton}>
        <Icon name="close" />
      </Pressable>
      
      {canUseTorch && (
        <Pressable onPress={onTorchToggle} style={styles.torchButton}>
          <Icon name={torchEnabled ? "flash-on" : "flash-off"} />
        </Pressable>
      )}
    </View>
  );
};
```

---

## ⚡ Критические оптимизации

### 1. Минимизация обработки

**Приоритеты:**
1. Обрабатывать только QR-коды (не все типы штрих-кодов)
2. Использовать ROI (центральная область)
3. Отключить проверку инвертированных кодов
4. Минимизировать аллокации в frame processor

### 2. Адаптивная производительность

**Стратегия:**
- Определение производительности устройства
- Адаптация FPS (60 → 30 → 15)
- Адаптация разрешения
- Адаптация ROI размера

```typescript
const getOptimalSettings = (deviceInfo: DeviceInfo) => {
  if (deviceInfo.isHighEnd) {
    return {
      fps: 60,
      resolution: 'max',
      roi: 0.8, // 80% экрана
    };
  } else if (deviceInfo.isMidRange) {
    return {
      fps: 30,
      resolution: 'high',
      roi: 0.6, // 60% экрана
    };
  } else {
    return {
      fps: 30,
      resolution: 'medium',
      roi: 0.5, // 50% экрана
    };
  }
};
```

### 3. Память и ресурсы

**Оптимизации:**
- Очистка буферов после обработки
- Минимизация аллокаций
- Использование native buffers
- Отключение ненужных функций

### 4. Батарея

**Оптимизации:**
- Отключение камеры при уходе в фон
- Адаптивный FPS в зависимости от состояния батареи
- Отключение torch при низком заряде
- Оптимизация обработки кадров

---

## 🧪 Тестирование производительности

### Метрики для измерения

1. **Время распознавания:**
   - От момента появления QR-кода в кадре
   - До момента вызова callback
   - Цель: < 100ms

2. **FPS камеры:**
   - Стабильность FPS
   - Падения FPS
   - Цель: стабильные 30-60 FPS

3. **Использование CPU:**
   - Нагрузка на основной поток
   - Нагрузка на frame processor
   - Цель: < 30% CPU

4. **Использование памяти:**
   - Потребление RAM
   - Утечки памяти
   - Цель: стабильное потребление

5. **Батарея:**
   - Потребление энергии
   - Нагрев устройства
   - Цель: минимальное потребление

### Тестовые сценарии

1. **Быстрое сканирование:**
   - QR-код появляется и исчезает быстро
   - Должен распознаться за < 100ms

2. **Несколько QR-кодов:**
   - Несколько кодов в кадре
   - Должен выбрать первый/центральный

3. **Плохое освещение:**
   - Низкая освещенность
   - Должен использовать torch или увеличить экспозицию

4. **Угол сканирования:**
   - QR-код под углом
   - Должен распознать с коррекцией перспективы

5. **Дальнее расстояние:**
   - QR-код далеко
   - Должен использовать zoom или подсказку приблизить

6. **Старые устройства:**
   - Тестирование на слабых устройствах
   - Должен работать с адаптивными настройками

---

## 📦 Структура файлов

```
features/Inventory/
├── components/
│   └── QrScanner/
│       ├── QrScannerScreen.tsx          # Основной экран
│       ├── ScannerOverlay.tsx           # UI overlay
│       ├── ScannerControls.tsx           # Кнопки управления
│       ├── FrameProcessor.ts            # Frame processor логика
│       ├── PerformanceMonitor.tsx       # Мониторинг производительности
│       ├── hooks/
│       │   ├── useQrScanner.ts          # Основной хук
│       │   ├── useCameraSettings.ts    # Настройки камеры
│       │   └── usePerformance.ts       # Оптимизация производительности
│       └── utils/
│           ├── deviceInfo.ts            # Информация об устройстве
│           ├── performance.ts           # Утилиты производительности
│           └── validation.ts            # Валидация QR-кодов
└── screens/
    └── QrScannerScreen.tsx              # Экран (обертка)
```

---

## 🚀 План реализации

### Этап 1: Базовая интеграция (1-2 дня)

- [ ] Установка react-native-vision-camera
- [ ] Установка vision-camera-code-scanner
- [ ] Настройка permissions
- [ ] Базовый экран с камерой
- [ ] Простое распознавание QR-кодов

### Этап 2: Оптимизация производительности (2-3 дня)

- [ ] Настройка оптимальных параметров камеры
- [ ] Реализация ROI (Region of Interest)
- [ ] Оптимизация frame processor
- [ ] Debounce для результатов
- [ ] Адаптивные настройки по устройству

### Этап 3: UI/UX (1-2 дня)

- [ ] ScannerOverlay с рамкой
- [ ] Анимация сканирующей линии
- [ ] Индикаторы состояния
- [ ] Кнопки управления (torch, close)
- [ ] Feedback (звук, вибрация)

### Этап 4: Дополнительные функции (1-2 дня)

- [ ] Auto focus оптимизация
- [ ] Torch (фонарик)
- [ ] Переключение камер (если доступно)
- [ ] Обработка ошибок
- [ ] Fallback для старых устройств

### Этап 5: Тестирование и оптимизация (2-3 дня)

- [ ] Тестирование на разных устройствах
- [ ] Измерение производительности
- [ ] Оптимизация на основе метрик
- [ ] Исправление багов
- [ ] Финальная полировка

---

## 📊 Ожидаемые результаты

### Производительность

- ⚡ **Время распознавания:** 50-150ms (зависит от устройства)
- 🎯 **Точность:** > 99%
- 📱 **FPS:** 30-60 FPS (стабильно)
- 🔋 **Батарея:** Оптимизированное потребление

### Сравнение с конкурентами

| Метрика | Наш сканер | Честный знак | ТСД |
|---------|------------|--------------|-----|
| Скорость | 50-150ms | 100-300ms | 50-200ms |
| Точность | > 99% | > 98% | > 99% |
| FPS | 30-60 | 20-30 | 30-60 |
| Поддержка устройств | Все | Все | Специализированные |

---

## 🔍 Дополнительные оптимизации

### 1. Предобработка изображения

**Техники:**
- Контрастность
- Яркость
- Резкость
- Шумоподавление

**Когда использовать:**
- Плохое освещение
- Размытый QR-код
- Старые устройства с плохой камерой

### 2. Множественное распознавание

**Стратегия:**
- Сканировать несколько кадров
- Голосование по результатам
- Выбор наиболее частого результата

**Когда использовать:**
- Низкое качество камеры
- Плохое освещение
- Дальнее расстояние

### 3. Кэширование результатов

**Оптимизация:**
- Кэш последних N результатов
- Проверка перед обработкой
- Быстрый возврат для повторных сканирований

### 4. Параллельная обработка

**Стратегия:**
- Обработка нескольких областей одновременно
- Использование нескольких потоков
- Оптимизация для многоядерных процессоров

---

## 🛠️ Инструменты для разработки

### 1. Performance Monitoring

```typescript
// Мониторинг FPS
const fps = useFps();

// Мониторинг памяти
const memory = useMemoryUsage();

// Мониторинг CPU
const cpu = useCpuUsage();
```

### 2. Debugging

```typescript
// Логирование производительности
const logPerformance = (metric: string, value: number) => {
  if (__DEV__) {
    console.log(`[QR Scanner Performance] ${metric}: ${value}ms`);
  }
};
```

### 3. Testing

```typescript
// Тестовые QR-коды
const testCodes = [
  'https://example.com',
  'DATA:1234567890',
  'CUSTOM:FORMAT:TEST',
];
```

---

## 📝 Чеклист реализации

### Базовый функционал
- [ ] Установка библиотек
- [ ] Настройка permissions
- [ ] Базовый экран сканера
- [ ] Распознавание QR-кодов
- [ ] Обработка результатов

### Оптимизация
- [ ] Настройка камеры (FPS, разрешение)
- [ ] ROI (Region of Interest)
- [ ] Debounce результатов
- [ ] Адаптивные настройки
- [ ] Оптимизация памяти

### UI/UX
- [ ] ScannerOverlay с рамкой
- [ ] Анимация сканирования
- [ ] Индикаторы состояния
- [ ] Кнопки управления
- [ ] Feedback (звук, вибрация)

### Дополнительно
- [ ] Auto focus
- [ ] Torch (фонарик)
- [ ] Переключение камер
- [ ] Обработка ошибок
- [ ] Fallback для старых устройств

### Тестирование
- [ ] Тестирование на разных устройствах
- [ ] Измерение производительности
- [ ] Оптимизация на основе метрик
- [ ] Исправление багов

---

## 🎯 Критерии успеха

### Производительность
- ✅ Распознавание за < 100ms на современных устройствах
- ✅ Стабильные 30-60 FPS
- ✅ Низкое потребление батареи
- ✅ Работа на старых устройствах

### Точность
- ✅ > 99% успешных распознаваний
- ✅ Работа в плохом освещении
- ✅ Работа под углом
- ✅ Работа на расстоянии

### UX
- ✅ Мгновенная обратная связь
- ✅ Понятный интерфейс
- ✅ Плавные анимации
- ✅ Отсутствие лагов

---

## 📚 Ресурсы

### Документация
- [react-native-vision-camera](https://react-native-vision-camera.com/)
- [vision-camera-code-scanner](https://github.com/rodgomesc/vision-camera-code-scanner)
- [ML Kit Barcode Scanning](https://developers.google.com/ml-kit/vision/barcode-scanning)

### Примеры
- [Official Examples](https://github.com/mrousavy/react-native-vision-camera/tree/main/example)
- [Code Scanner Examples](https://github.com/rodgomesc/vision-camera-code-scanner/tree/main/example)

### Оптимизация
- [Camera Performance Best Practices](https://developer.android.com/training/camera2)
- [AVFoundation Best Practices](https://developer.apple.com/documentation/avfoundation)

---

*Документ создан для реализации максимально производительного QR-сканера*
*Дата: 2025*

