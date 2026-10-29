import type { BarcodeScanner } from "./barcode-scanner";
import { CAMERA_CONSTRAINTS, toCameraError } from "./camera";

/** Fallback for browsers without BarcodeDetector (Safari on iPhone). The library loads only when needed. */
export class ZxingScanner implements BarcodeScanner {
  private stopReading: (() => void) | null = null;

  async start(video: HTMLVideoElement, onCode: (code: string) => void): Promise<void> {
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map([
      [
        DecodeHintType.POSSIBLE_FORMATS,
        [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF, // a wholesale box (DUN-14)
        ],
      ],
    ]);
    const reader = new BrowserMultiFormatReader(hints);

    try {
      const controls = await reader.decodeFromConstraints(CAMERA_CONSTRAINTS, video, (result) => {
        if (result) onCode(result.getText());
      });
      this.stopReading = () => controls.stop();
    } catch (error) {
      throw toCameraError(error);
    }
  }

  stop(): void {
    this.stopReading?.();
    this.stopReading = null;
  }
}
