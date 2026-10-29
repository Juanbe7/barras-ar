import { describe, expect, it } from "vitest";
import { presentationFromText } from "../src/domain/presentation-text.js";

// descriptions taken from the SEPA data
describe("presentationFromText", () => {
  it.each([
    ["GALLETITAS SURTIDO BAGLEY BOLSA X 400 GRS", 400, "g"],
    ["G.SURTIDO BAGLEY X400G.", 400, "g"],
    ["Pan blanco LACTAL x 460g", 460, "g"],
    ["piedras sanitarias DRY WAY 4 kg", 4000, "g"],
    ["SODA SALDAN X 1.5 LT", 1500, "ml"],
    ["COCA COLA GASEOSA SABOR ORIGINAL MENOS AZUCARES 2,25L", 2250, "ml"],
    ["ACONDICIONADOR NUTRICION CREMOSA, PLUSBELLE, 1000 cm3", 1000, "ml"],
    ["APERITIVO FERNET BRANCA 450 CC", 450, "ml"],
    ["vino MANDALA Rose 750cc", 750, "ml"],
    ["HERMETICO SAN REMO FRESHY 1.24 LTS", 1240, "ml"],
    ["FOSFOROS TRADICIONALES RANCHERA CJA 220 UNI", 220, "unit"],
  ])("reads %s", (description, quantity, unit) => {
    expect(presentationFromText(description)).toEqual({ quantity, unit });
  });

  it("multiplies a multipack into its total", () => {
    expect(presentationFromText("ALFAJOR S TACC DE CHOCOLATE HAPPY FOOD 3 X 50 GRS")).toEqual({
      quantity: 150,
      unit: "g",
    });
  });

  it("does not multiply when the first number is a model number or a piece count", () => {
    expect(presentationFromText("ARROZ 53 X500G.L/FINO")).toEqual({ quantity: 500, unit: "g" });
    expect(presentationFromText("FIDEOS ITALIA CINTITA NIDO 36 X500G")).toEqual({ quantity: 500, unit: "g" });
    expect(presentationFromText("SUGUS MAX ANANA 70X7,5GR")).toEqual({ quantity: 7.5, unit: "g" });
  });

  it("prefers a weight or volume over a count, and the last one over earlier ones", () => {
    expect(presentationFromText("BARRA CEREAL 6 UNI X 20G")).toEqual({ quantity: 20, unit: "g" });
    expect(presentationFromText("CAFE 100 G PROMO 250 G")).toEqual({ quantity: 250, unit: "g" });
  });

  it("reads a thousands separator next to a small unit", () => {
    expect(presentationFromText("ARROZ 1.000 GR")).toEqual({ quantity: 1000, unit: "g" });
  });

  it("returns null when the description states no presentation", () => {
    expect(presentationFromText("SMART TV 43 NOBLEX FHD DV43X7180")).toBeNull();
    expect(presentationFromText("JARRA ELECTRICA PHILIPS BLANCA HD9368 00")).toBeNull();
    expect(presentationFromText("LECHE UAT 1% LA SERENISIMA")).toBeNull();
  });

  it("does not report a generic '1 unit'", () => {
    expect(presentationFromText("DONUT BAÑADAS ROSA COTO 1 UNI")).toBeNull();
  });

  it("does not mistake the start of a word for a unit", () => {
    expect(presentationFromText("CAJA 12 LAPICES DE COLORES")).toBeNull();
    expect(presentationFromText("SHAMPOO 2 EN 1 LARGO")).toBeNull();
  });
});
