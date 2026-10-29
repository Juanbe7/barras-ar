import { describe, expect, it } from "vitest";
import { parseRoute, pathForQuery, paths } from "../src/router/routes";

describe("parseRoute", () => {
  it("reads each screen", () => {
    expect(parseRoute("")).toEqual({ name: "home" });
    expect(parseRoute("#/")).toEqual({ name: "home" });
    expect(parseRoute("#/scan")).toEqual({ name: "scan" });
    expect(parseRoute("#/product/7790040147720")).toEqual({ name: "product", ean: "7790040147720" });
    expect(parseRoute("#/search/galletitas%20bagley")).toEqual({
      name: "search",
      query: "galletitas bagley",
    });
  });

  it("sends unknown or malformed routes home", () => {
    expect(parseRoute("#/nada")).toEqual({ name: "home" });
    expect(parseRoute("#/product/abc")).toEqual({ name: "home" });
    expect(parseRoute("#/product")).toEqual({ name: "home" });
    expect(parseRoute("#/search/%E0%A4%A")).toEqual({ name: "home" });
  });

  it("round-trips the paths it builds", () => {
    expect(parseRoute(`#${paths.search("leche 1 l/2")}`)).toEqual({ name: "search", query: "leche 1 l/2" });
  });
});

describe("pathForQuery", () => {
  it("opens the product for a barcode and the search for text", () => {
    expect(pathForQuery("7790040147720")).toBe("/product/7790040147720");
    expect(pathForQuery("  yerba playadito ")).toBe("/search/yerba%20playadito");
  });

  it("ignores an empty query", () => {
    expect(pathForQuery("   ")).toBeNull();
  });
});
