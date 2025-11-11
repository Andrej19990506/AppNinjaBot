declare module '@zxing/browser' {
  export class BrowserMultiFormatReader {
    constructor(hints?: unknown, timeBetweenScansMillis?: number);
    decodeFromVideoElementContinuously(
      videoElement: HTMLVideoElement,
      callback: (result: unknown, err: unknown) => void
    ): void;
    decodeFromVideoDevice(
      deviceId: string | undefined,
      videoElement: HTMLVideoElement,
      callback: (result: unknown, err: unknown) => void
    ): Promise<void>;
    reset(): void;
  }
}
