import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "../src/products/search-query.js";

describe("parseSearchQuery", () => {
  it("lowercases and splits into words", () => {
    expect(parseSearchQuery("Galletitas Bagley")).toEqual(["galletitas", "bagley"]);
  });

  it("drops accents the same way the ingestion does", () => {
    expect(parseSearchQuery("CASTAÑAS Jamón")).toEqual(["castanas", "jamon"]);
  });

  it("splits on symbols and keeps digits", () => {
    expect(parseSearchQuery("coca-cola 2,25l")).toEqual(["coca", "cola", "2", "25l"]);
  });

  it("returns no words when there is nothing searchable", () => {
    expect(parseSearchQuery("   !!! ")).toEqual([]);
  });

  it("caps the number and length of words", () => {
    expect(parseSearchQuery("a b c d e f g h i j")).toHaveLength(8);
    expect(parseSearchQuery("x".repeat(100))[0]).toHaveLength(40);
  });
});
