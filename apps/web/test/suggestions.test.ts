import { describe, expect, it } from "vitest";
import { shouldSuggest } from "../src/domain/suggestions";

describe("shouldSuggest", () => {
  it("suggests for a name of two or more characters", () => {
    expect(shouldSuggest("ga")).toBe(true);
    expect(shouldSuggest("  galletitas bagley ")).toBe(true);
  });

  it("does not suggest for one letter or empty text", () => {
    expect(shouldSuggest("g")).toBe(false);
    expect(shouldSuggest("   ")).toBe(false);
  });

  it("does not suggest while a barcode is typed", () => {
    expect(shouldSuggest("7790040147720")).toBe(false);
  });

  it("still suggests for short numbers, which are part of a name", () => {
    expect(shouldSuggest("12")).toBe(true);
    expect(shouldSuggest("leche 1")).toBe(true);
  });
});
