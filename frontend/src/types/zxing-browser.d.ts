declare module '@zxing/browser' {
  export class BrowserMultiFormatReader {
    constructor(hints?: unknown, timeBetweenScansMillis?: number);
    decodeFromVideoElementContinuously(
      videoElement: HTMLVideoElement,
      callback: (result: unknown, err: unknown) => void
    ): void;
    reset(): void;
  }
}
