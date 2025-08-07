class SoundService {
  private static instance: SoundService;
  private audioContext: AudioContext | null = null;
  private notificationSound: HTMLAudioElement | null = null;
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
      // Создаем аудио элемент для уведомлений
      this.notificationSound = new Audio('/sounds/notification.mp3');
      this.notificationSound.preload = 'auto';
      this.notificationSound.volume = 0.3; // Устанавливаем громкость на 30%
      
      console.log('🔊 [SoundService] Аудио элемент инициализирован');
    } catch (error) {
      console.error('❌ [SoundService] Ошибка инициализации аудио:', error);
    }
  }

  /**
   * Воспроизводит звук уведомления
   */
  playNotificationSound(): void {
    if (!this.isEnabled || !this.notificationSound) {
      return;
    }

    try {
      // Сбрасываем время воспроизведения на начало
      this.notificationSound.currentTime = 0;
      
      // Воспроизводим звук
      this.notificationSound.play().catch((error) => {
        console.error('❌ [SoundService] Ошибка воспроизведения звука:', error);
      });
      
      console.log('🔊 [SoundService] Воспроизводится звук уведомления');
    } catch (error) {
      console.error('❌ [SoundService] Ошибка при воспроизведении звука:', error);
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