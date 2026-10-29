import type { BarcodeScanner } from "./barcode-scanner";
import { NativeScanner } from "./native-scanner";
import { ZxingScanner } from "./zxing-scanner";

/** The browser's own detector when it can read retail barcodes, the ZXing library otherwise. */
export async function createScanner(): Promise<BarcodeScanner> {
  return (await NativeScanner.isSupported()) ? new NativeScanner() : new ZxingScanner();
}
