import { toAsciiUpper } from "./text.js";

const ALLOWED_SHORT_WORDS = new Set([
  "DE",
  "CON",
  "SIN",
  "LA",
  "EL",
  "LOS",
  "LAS",
  "Y",
  "EN",
  "X",
  "P/",
  "PARA",
]);
const PLACEHOLDER_BRANDS = new Set(["SIN MARCA", "GENERICO"]);
const WORD = "[A-Za-zÁÉÍÓÚÑáéíóúñ]";
const TOKENS = new RegExp(`${WORD}+\\.?|\\d+[.,]?\\d*`, "g");
const STARTS_WITH_LETTER = new RegExp(`^${WORD}`);

/** What one chain reports for a barcode. */
export interface Variant {
  description: string;
  brand: string;
  quantity: string;
  unit: string;
}

/** The brand most chains agree on, upper-cased and accent-free; empty and "SIN MARCA" are ignored. */
export function pickBrand(variants: Variant[]): string {
  const counts = new Map<string, number>();
  for (const variant of variants) {
    const brand = toAsciiUpper(variant.brand).trim();
    if (!brand || PLACEHOLDER_BRANDS.has(brand)) continue;
    counts.set(brand, (counts.get(brand) ?? 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [brand, count] of counts) if (count > bestCount) [best, bestCount] = [brand, count];
  return best;
}

/** Completeness score: whole words, the brand name and a presentation all raise it. */
function score(description: string, brand: string): number {
  const tokens = description.match(TOKENS) ?? [];
  const words = tokens.filter((t) => STARTS_WITH_LETTER.test(t));
  const whole = words.filter((w) => w.replace(/\.+$/, "").length >= 4 && !w.endsWith(".")).length;
  const abbreviated = words.filter(
    (w) => w.endsWith(".") || (w.length <= 3 && !ALLOWED_SHORT_WORDS.has(w.toUpperCase())),
  ).length;

  let total = whole * 2 - abbreviated;
  const firstBrandWord = brand.split(/\s+/)[0];
  if (firstBrandWord && toAsciiUpper(description).includes(firstBrandWord)) total += 3;
  if (/\d/.test(description)) total += 2;
  return total;
}

/** The most complete description among the chains; the longer one wins a tie. */
export function pickDescription(variants: Variant[], brand: string): string {
  let best = "";
  let bestKey: [number, number] | null = null;
  for (const { description } of variants) {
    const key: [number, number] = [score(description, brand), description.length];
    if (!bestKey || key[0] > bestKey[0] || (key[0] === bestKey[0] && key[1] > bestKey[1])) {
      [best, bestKey] = [description, key];
    }
  }
  return best;
}
