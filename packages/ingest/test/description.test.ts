import { describe, expect, it } from "vitest";
import { pickBrand, pickDescription, type Variant } from "../src/domain/description.js";
import { cleanDescription, parseNumber, searchWords } from "../src/domain/text.js";

const variant = (description: string, brand = ""): Variant => ({
  description,
  brand,
  quantity: "1",
  unit: "unidad",
});

describe("cleanDescription", () => {
  it("strips the suffix some chains append", () => {
    expect(cleanDescription("SAL FINA CELUSAL BSA-80-gr.")).toBe("SAL FINA CELUSAL");
    expect(cleanDescription("VINO TINTO BOT-750-ml. BSA-750-ml.")).toBe("VINO TINTO");
  });

  it("collapses spaces and trims punctuation at the ends", () => {
    expect(cleanDescription("  GALLETITAS   SURTIDAS,  ")).toBe("GALLETITAS SURTIDAS");
  });
});

describe("searchWords", () => {
  it("lowercases, drops accents and splits on symbols", () => {
    expect(searchWords("CHOCOLATE C/LECHE CASTAÑAS, 155 gr")).toEqual([
      "chocolate",
      "c",
      "leche",
      "castanas",
      "155",
      "gr",
    ]);
  });
});

describe("parseNumber", () => {
  it("reads the formats chains use", () => {
    expect(parseNumber("00400")).toBe(400);
    expect(parseNumber("0.4")).toBe(0.4);
    expect(parseNumber("02500.00")).toBe(2500);
    expect(parseNumber("2500,5")).toBe(2500.5);
  });

  it("returns null when it is not a number", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber(" ")).toBeNull();
    expect(parseNumber("12abc")).toBeNull();
  });
});

describe("pickBrand", () => {
  it("takes the most common one and ignores empty and 'SIN MARCA'", () => {
    const variants = [
      variant("a", "BAGLEY"),
      variant("b", "Bagley"),
      variant("c", ""),
      variant("d", "SIN MARCA"),
      variant("e", "BAGLE"),
    ];
    expect(pickBrand(variants)).toBe("BAGLEY");
  });

  it("returns empty when no chain reports a brand", () => {
    expect(pickBrand([variant("a"), variant("b", "Sin marca")])).toBe("");
  });
});

describe("pickDescription", () => {
  const bagley = [
    variant("GALLETITAS SURTIDAS, BAGLEY, 400 gr", "BAGLEY"),
    variant("GALL SURTIDO BAGLEY", "BAGLEY"),
    variant("G.SURTIDO BAGLEY X400G."),
    variant("GALLETITAS SURTIDAS"),
  ];

  it("prefers the most complete one, with brand and presentation (Bagley case)", () => {
    expect(pickDescription(bagley, "BAGLEY")).toBe("GALLETITAS SURTIDAS, BAGLEY, 400 gr");
  });

  it("the longer one wins a tie", () => {
    expect(pickDescription([variant("LECHE ENTERA"), variant("LECHE ENTERA SERENISIMA")], "")).toBe(
      "LECHE ENTERA SERENISIMA",
    );
  });
});
