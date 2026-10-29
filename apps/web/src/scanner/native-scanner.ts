import type { BarcodeScanner } from "./barcode-scanner";
import { openCamera } from "./camera";

// BarcodeDetector is not in the TypeScript DOM library yet
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorApi {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): BarcodeDetectorApi;
  getSupportedFormats(): Promise<string[]>;
}

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];
const DETECT_INTERVAL_MS = 150;

function detectorConstructor(): BarcodeDetectorConstructor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

/** Scanner built on the browser's own BarcodeDetector (Chrome on Android): fast and with no extra download. */
export class NativeScanner implements BarcodeScanner {
  private stream: MediaStream | null = null;
  private timer: number | undefined;

  static async isSupported(): Promise<boolean> {
    const Detector = detectorConstructor();
    if (!Detector) return false;
    const supported = await Detector.getSupportedFormats();
    return FORMATS.every((format) => supported.includes(format));
  }

  async start(video: HTMLVideoElement, onCode: (code: string) => void): Promise<void> {
    const detector = new (detectorConstructor()!)({ formats: FORMATS });
    this.stream = await openCamera();
    video.srcObject = this.stream;
    await video.play();

    this.timer = window.setInterval(async () => {
      const [barcode] = await detector.detect(video).catch(() => []);
      if (barcode) onCode(barcode.rawValue);
    }, DETECT_INTERVAL_MS);
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}
