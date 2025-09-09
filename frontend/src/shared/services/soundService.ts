class SoundService {
  private static instance: SoundService;
  private audioContext: AudioContext | null = null;
  private notificationSound: HTMLAudioElement | null = null;
  private successSound: HTMLAudioElement | null = null;
  private errorSound: HTMLAudioElement | null = null;
  private isEnabled: boolean = true;

  private constructor() {
    console.log('🔊 [SoundService] Инициализация звукового сервиса');
    this.initAudio();
  }

  static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService();
    }
    return SoundService.instance;
  }

  private initAudio(): void {
    try {
      // Создаем аудио элемент для обычных уведомлений
      this.notificationSound = new Audio('/sounds/notification.mp3');
      this.notificationSound.preload = 'auto';
      this.notificationSound.volume = 0.3;
      
      // Создаем аудио элемент для успешных уведомлений
      this.successSound = new Audio('/sounds/notification.mp3');
      this.successSound.preload = 'auto';
      this.successSound.volume = 0.3;
      
      // Создаем аудио элемент для ошибок
      this.errorSound = new Audio('/sounds/error.mp3');
      this.errorSound.preload = 'auto';
      this.errorSound.volume = 0.3;
      
      console.log('🔊 [SoundService] Аудио элементы инициализированы');
    } catch (error) {
      console.error('❌ [SoundService] Ошибка инициализации аудио:', error);
    }
  }

  /**
   * Воспроизводит звук уведомления (общий)
   */
  playNotificationSound(): void {
    this.playSound(this.notificationSound, 'уведомления');
  }

  /**
   * Воспроизводит звук успеха
   */
  playSuccessSound(): void {
    this.playSound(this.successSound, 'успеха');
  }

  /**
   * Воспроизводит звук ошибки
   */
  playErrorSound(): void {
    this.playSound(this.errorSound, 'ошибки');
  }

  /**
   * Воспроизводит звук в зависимости от типа уведомления
   */
  playSoundByType(type: 'success' | 'error' | 'notification'): void {
    switch (type) {
      case 'success':
        this.playSuccessSound();
        break;
      case 'error':
        this.playErrorSound();
        break;
      default:
        this.playNotificationSound();
        break;
    }
  }

  /**
   * Внутренний метод для воспроизведения звука
   */
  private playSound(audioElement: HTMLAudioElement | null, soundType: string): void {
    if (!this.isEnabled || !audioElement) {
      return;
    }

    try {
      // Сбрасываем время воспроизведения на начало
      audioElement.currentTime = 0;
      
      // Воспроизводим звук
      audioElement.play().catch((error) => {
        console.error(`❌ [SoundService] Ошибка воспроизведения звука ${soundType}:`, error);
      });
      
      console.log(`🔊 [SoundService] Воспроизводится звук ${soundType}`);
    } catch (error) {
      console.error(`❌ [SoundService] Ошибка при воспроизведении звука ${soundType}:`, error);
    }
  }

  /**
   * Включает/выключает звуки
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log(`🔊 [SoundService] Звуки ${enabled ? 'включены' : 'выключены'}`);
  }

  /**
   * Проверяет, включены ли звуки
   */
  isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Устанавливает громкость звука (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    if (this.notificationSound) {
      this.notificationSound.volume = Math.max(0, Math.min(1, volume));
      console.log(`🔊 [SoundService] Громкость установлена на ${volume}`);
    }
  }

  /**
   * Получает текущую громкость
   */
  getVolume(): number {
    return this.notificationSound?.volume || 0;
  }
}

export const soundService = SoundService.getInstance(); 