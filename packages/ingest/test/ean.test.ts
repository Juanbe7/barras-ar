import { describe, expect, it } from "vitest";
import { isValidEan, normalizeEan } from "../src/domain/ean.js";

describe("isValidEan", () => {
  it("accepts real EAN-13 codes", () => {
    expect(isValidEan("7790040147720")).toBe(true);
    expect(isValidEan("7791813434412")).toBe(true);
  });

  it("accepts EAN-8 and UPC-A", () => {
    expect(isValidEan("73513537")).toBe(true);
    expect(isValidEan("036000291452")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidEan("7790040147721")).toBe(false);
  });

  it("rejects empty and non-numeric input", () => {
    expect(isValidEan("")).toBe(false);
    expect(isValidEan("77900401477A0")).toBe(false);
  });
});

describe("normalizeEan", () => {
  it("pads to 13 digits", () => {
    expect(normalizeEan("73513537")).toBe("0000073513537");
    expect(normalizeEan("036000291452")).toBe("0036000291452");
  });

  it("leaves an EAN-13 untouched", () => {
    expect(normalizeEan("7790040147720")).toBe("7790040147720");
  });
});
