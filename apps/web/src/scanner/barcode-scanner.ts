export interface BarcodeScanner {
  /** Opens the camera on the video element and calls `onCode` for every barcode it reads. */
  start(video: HTMLVideoElement, onCode: (code: string) => void): Promise<void>;
  /** Releases the camera. Safe to call more than once. */
  stop(): void;
}
