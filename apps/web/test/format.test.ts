import { describe, expect, it } from "vitest";
import { formatChains, formatDate, formatPrice } from "../src/domain/format";
import { positionInRange } from "../src/domain/price-position";

describe("formatPrice", () => {
  it("uses Argentine separators and no decimals", () => {
    // the locale puts a (non-breaking) space after the peso sign; compare without whitespace
    expect(formatPrice(3850).replace(/\s/g, "")).toBe("$3.850");
    expect(formatPrice(1899.49).replace(/\s/g, "")).toBe("$1.899");
    expect(formatPrice(1250000).replace(/\s/g, "")).toBe("$1.250.000");
  });
});

describe("formatDate", () => {
  it("turns an ISO day into day/month/year", () => {
    expect(formatDate("2026-10-29")).toBe("29/10/2026");
  });
});

describe("formatChains", () => {
  it("pluralizes", () => {
    expect(formatChains(1)).toBe("1 cadena");
    expect(formatChains(7)).toBe("7 cadenas");
  });
});

describe("positionInRange", () => {
  it("places the median between min and max", () => {
    expect(positionInRange(3850, 2500, 3985)).toBeCloseTo(0.9, 1);
    expect(positionInRange(2500, 2500, 3985)).toBe(0);
    expect(positionInRange(3985, 2500, 3985)).toBe(1);
  });

  it("centers the dot when there is no range", () => {
    expect(positionInRange(1000, 1000, 1000)).toBe(0.5);
  });

  it("keeps an out-of-range median inside the line", () => {
    expect(positionInRange(5000, 1000, 2000)).toBe(1);
    expect(positionInRange(10, 1000, 2000)).toBe(0);
  });
});
