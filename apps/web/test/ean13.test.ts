import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import { describe, expect, it } from "vitest";
import { EAN13_MODULES, encodeEan13 } from "../src/domain/ean13";

/** Draws the modules as a grayscale picture (black bars on white, with quiet zones) and reads it with ZXing. */
function decode(modules: string): string {
  const scale = 4;
  const quiet = 10 * scale;
  const width = modules.length * scale + quiet * 2;
  const height = 80;
  const pixels = new Uint8ClampedArray(width * height).fill(255);
  for (let y = 0; y < height; y++) {
    for (let m = 0; m < modules.length; m++) {
      if (modules[m] !== "1") continue;
      for (let x = 0; x < scale; x++) pixels[y * width + quiet + m * scale + x] = 0;
    }
  }
  const reader = new MultiFormatReader();
  reader.setHints(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]]]));
  const bitmap = new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(pixels, width, height)));
  return reader.decode(bitmap).getText();
}

describe("encodeEan13", () => {
  it("makes 95 modules framed by the start, middle and end guards", () => {
    const modules = encodeEan13("7790040147720");
    expect(modules).toHaveLength(EAN13_MODULES);
    expect(modules.slice(0, 3)).toBe("101");
    expect(modules.slice(45, 50)).toBe("01010");
    expect(modules.slice(92)).toBe("101");
  });

  it.each(["7790040147720", "4006381333931", "5901234123457", "0036000291452"])(
    "is read back as the same code by a real decoder: %s",
    (code) => {
      // ZXing reports a code that starts with 0 as a 12-digit UPC-A; the catalog pads it back to 13
      expect(decode(encodeEan13(code)).padStart(13, "0")).toBe(code);
    },
  );

  it("rejects anything that is not 13 digits", () => {
    expect(() => encodeEan13("123")).toThrow();
    expect(() => encodeEan13("77900401477201")).toThrow();
    expect(() => encodeEan13("779004014772a")).toThrow();
  });
});
