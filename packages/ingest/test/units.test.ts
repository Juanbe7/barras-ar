import { describe, expect, it } from "vitest";
import { normalizePresentation, pickPresentation } from "../src/domain/units.js";

describe("normalizePresentation", () => {
  it("unifies gram spellings and number formats", () => {
    const spellings = [
      ["400", "gr"],
      ["400.00", "GR"],
      ["00400", "grm"],
      ["400", "GRS"],
    ] as const;
    for (const [quantity, unit] of spellings) {
      expect(normalizePresentation({ quantity, unit })).toEqual({ quantity: 400, unit: "g" });
    }
  });

  it("converts kg to g and l to ml", () => {
    expect(normalizePresentation({ quantity: "0.4", unit: "KG" })).toEqual({ quantity: 400, unit: "g" });
    expect(normalizePresentation({ quantity: "1,5", unit: "lt" })).toEqual({ quantity: 1500, unit: "ml" });
  });

  it("treats cc and cm3 as ml, and UNI/EA as unit", () => {
    expect(normalizePresentation({ quantity: "473", unit: "cc" })).toEqual({ quantity: 473, unit: "ml" });
    expect(normalizePresentation({ quantity: "2838", unit: "cm3" })).toEqual({ quantity: 2838, unit: "ml" });
    expect(normalizePresentation({ quantity: "1", unit: "EA" })).toEqual({ quantity: 1, unit: "unit" });
  });

  it("returns null for an unknown unit or an invalid quantity", () => {
    expect(normalizePresentation({ quantity: "5", unit: "metros" })).toBeNull();
    expect(normalizePresentation({ quantity: "", unit: "g" })).toBeNull();
    expect(normalizePresentation({ quantity: "0", unit: "g" })).toBeNull();
    expect(normalizePresentation({ quantity: "abc", unit: "g" })).toBeNull();
  });
});

describe("pickPresentation", () => {
  it("picks the most common one and ignores a generic '1 unit' (Bagley case)", () => {
    const picked = pickPresentation([
      { quantity: "400", unit: "gr" },
      { quantity: "1", unit: "UNI" },
      { quantity: "0.4", unit: "KG" },
      { quantity: "400", unit: "grm" },
      { quantity: "1", unit: "UNI" },
      { quantity: "1", unit: "UNI" },
    ]);
    expect(picked).toEqual({ quantity: 400, unit: "g" });
  });

  it("returns '1 unit' when it is all there is", () => {
    expect(pickPresentation([{ quantity: "1", unit: "unidad" }])).toEqual({ quantity: 1, unit: "unit" });
  });

  it("returns null when no variant can be interpreted", () => {
    expect(pickPresentation([{ quantity: "x", unit: "y" }])).toBeNull();
  });
});
