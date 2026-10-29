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

// the retail codes, plus ITF, which is how a wholesale box (DUN-14) is printed
const WANTED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "itf"];
const DETECT_INTERVAL_MS = 150;

function detectorConstructor(): BarcodeDetectorConstructor | undefined {
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
}

/** Scanner built on the browser's own BarcodeDetector (Chrome on Android): fast and with no extra download. */
export class NativeScanner implements BarcodeScanner {
  private stream: MediaStream | null = null;
  private timer: number | undefined;

  /** The wanted formats this browser can read; a phone without ITF still reads the retail ones. */
  private static async supportedFormats(): Promise<string[]> {
    const Detector = detectorConstructor();
    if (!Detector) return [];
    const supported = await Detector.getSupportedFormats();
    return WANTED_FORMATS.filter((format) => supported.includes(format));
  }

  static async isSupported(): Promise<boolean> {
    return (await NativeScanner.supportedFormats()).includes("ean_13");
  }

  async start(video: HTMLVideoElement, onCode: (code: string) => void): Promise<void> {
    const detector = new (detectorConstructor()!)({ formats: await NativeScanner.supportedFormats() });
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
