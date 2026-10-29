import { normalizePresentation, type Presentation } from "./units.js";

// Unit spellings that appear inside descriptions ("400 GRS", "1.5LT", "x40G", "125 cm3", "6 UNI").
const UNIT =
  "(?:kgs?|kgm|kgr|kilos?|grs?|grm|gramos|gm|g|ml|cm3|cc|cmq|lts?|ltr|litros?|l|unidades|unidad|unid|uni|und|un|u)";
const NUMBER = "\\d+(?:[.,]\\d+)?";
// the number must not be the tail of a longer one; letters before it are fine ("X400G")
const START = "(?<![\\d.,])";
const END = "(?![a-zA-Z])";

// "3 X 50 GRS" (a multipack) first, or else a plain "50 GRS"; alternation keeps the plain one from reusing the multipack's text
const QUANTITY = new RegExp(
  `${START}(\\d+)\\s*[x*]\\s*(${NUMBER})\\s*(${UNIT})${END}|${START}(${NUMBER})\\s*(${UNIT})${END}`,
  "gi",
);

// Measured on the catalog, when a description reads "N X M g" the chains' own quantity is the total N×M for
// N of 2 to 3 in 91% of the cases and for 4 to 6 in 58%, but for 7 or more it is just M in over 70%:
// there N is a model number ("ARROZ 53 X500G") or a piece count, not a multipack.
const MAX_MULTIPACK = 6;
const multiplier = (times: number) => (times <= MAX_MULTIPACK ? times : 1);

/** "1.000" next to a small unit is a thousand, not one point zero. */
function parseQuantity(raw: string, unit: string): number {
  const isSmallUnit = normalizePresentation({ quantity: "1", unit })?.quantity === 1;
  const thousands = /^\d{1,3}\.\d{3}$/.test(raw) && isSmallUnit;
  return Number(thousands ? raw.replace(".", "") : raw.replace(",", "."));
}

/**
 * The presentation written in a description, for the products whose chains report none
 * (wholesale files carry no quantity field) or only a generic "1 unit".
 *
 * A weight or volume wins over a count, and the last one in the text wins over earlier ones, since the
 * presentation usually closes the description. A multipack ("3 X 50 GRS") is the total (150 g), up to 6 packs.
 */
export function presentationFromText(description: string): Presentation | null {
  const measures: Presentation[] = [];
  const counts: Presentation[] = [];

  for (const match of description.matchAll(QUANTITY)) {
    const [, times, packNumber, packUnit, number, unit] = match;
    const quantity = times
      ? multiplier(Number(times)) * parseQuantity(packNumber ?? "", packUnit ?? "")
      : parseQuantity(number ?? "", unit ?? "");
    const presentation = normalizePresentation({ quantity: String(quantity), unit: packUnit ?? unit ?? "" });
    if (!presentation || presentation.quantity > 100_000) continue;
    (presentation.unit === "unit" ? counts : measures).push(presentation);
  }

  // "1 unit" says nothing, so only a count above one is worth reporting
  return measures.at(-1) ?? counts.filter((c) => c.quantity > 1).at(-1) ?? null;
}
