class SoundService {
  private static instance: SoundService;
  private audioContext: AudioContext | null = null;
  private notificationSound: HTMLAudioElement | null = null;
  private successSound: HTMLAudioElement | null = null;
  private errorSound: HTMLAudioElement | null = null;
  private winterMusic: HTMLAudioElement | null = null;
  private isEnabled: boolean = true;
  private isMusicPlaying: boolean = false;

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
      
      // Создаем аудио элемент для зимней музыки (Чайковский - Щелкунчик)
      this.winterMusic = new Audio('/sounds/chajkovskij-balet-cshelkunchik.mp3');
      this.winterMusic.preload = 'auto';
      this.winterMusic.volume = 0.15; // Тише, чтобы не мешать основному контенту
      this.winterMusic.loop = false; // НЕ зацикливаем - играет один раз
      
      // Сбрасываем флаг когда музыка заканчивается
      this.winterMusic.addEventListener('ended', () => {
        this.isMusicPlaying = false;
        console.log('🎵 [SoundService] Зимняя музыка закончилась, флаг сброшен');
      });
      
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

  /**
   * Запускает зимнюю фоновую музыку (Чайковский - Щелкунчик)
   * Возвращает Promise<boolean> - true если успешно, false если заблокировано
   */
  async playWinterMusic(): Promise<boolean> {
    if (!this.isEnabled || !this.winterMusic || this.isMusicPlaying) {
      return false;
    }

    try {
      this.winterMusic.currentTime = 0;
      await this.winterMusic.play();
      this.isMusicPlaying = true;
      console.log('✅ [SoundService] Зимняя музыка (Чайковский) успешно запущена');
      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        console.log('⚠️ [SoundService] Автовоспроизведение заблокировано браузером. Ожидание взаимодействия пользователя...');
      } else {
        console.error('❌ [SoundService] Ошибка воспроизведения зимней музыки:', error);
      }
      return false;
    }
  }

  /**
   * Останавливает зимнюю фоновую музыку
   */
  stopWinterMusic(): void {
    if (!this.winterMusic || !this.isMusicPlaying) {
      return;
    }

    try {
      this.winterMusic.pause();
      this.winterMusic.currentTime = 0;
      this.isMusicPlaying = false;
      console.log('❄️🎵 [SoundService] Зимняя музыка остановлена');
    } catch (error) {
      console.error('❌ [SoundService] Ошибка при остановке зимней музыки:', error);
    }
  }

  /**
   * Проверяет, играет ли сейчас зимняя музыка
   */
  isWinterMusicPlaying(): boolean {
    return this.isMusicPlaying;
  }

  /**
   * Устанавливает громкость зимней музыки (0.0 - 1.0)
   */
  setWinterMusicVolume(volume: number): void {
    if (this.winterMusic) {
      this.winterMusic.volume = Math.max(0, Math.min(1, volume));
      console.log(`❄️🎵 [SoundService] Громкость зимней музыки установлена на ${volume}`);
    }
  }

  /**
   * Получает элемент зимней музыки для подписки на события
   */
  getWinterMusicElement(): HTMLAudioElement | null {
    return this.winterMusic;
  }
}

export const soundService = SoundService.getInstance(); 