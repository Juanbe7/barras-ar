import { describe, expect, it } from "vitest";
import { hasValidCheckDigit, looksLikeBarcode } from "../src/domain/barcode";

describe("looksLikeBarcode", () => {
  it("accepts 8 to 14 digits", () => {
    expect(looksLikeBarcode("12345678")).toBe(true);
    expect(looksLikeBarcode("7790040147720")).toBe(true);
    expect(looksLikeBarcode("12345678901234")).toBe(true);
  });

  it("rejects text, spaces and wrong lengths", () => {
    expect(looksLikeBarcode("galletitas")).toBe(false);
    expect(looksLikeBarcode("1234567")).toBe(false);
    expect(looksLikeBarcode("123456789012345")).toBe(false);
    expect(looksLikeBarcode("7790 0401")).toBe(false);
  });
});

describe("hasValidCheckDigit", () => {
  it("accepts real EAN-13 and EAN-8 codes", () => {
    expect(hasValidCheckDigit("7790040147720")).toBe(true);
    expect(hasValidCheckDigit("4006381333931")).toBe(true);
    expect(hasValidCheckDigit("96385074")).toBe(true);
  });

  it("rejects a misread digit", () => {
    expect(hasValidCheckDigit("7790040147721")).toBe(false);
    expect(hasValidCheckDigit("4006381333932")).toBe(false);
  });

  it("rejects anything that is not shaped like a barcode", () => {
    expect(hasValidCheckDigit("abc")).toBe(false);
  });
});
