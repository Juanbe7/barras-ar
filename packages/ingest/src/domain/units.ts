import { parseNumber, round2 } from "./text.js";

/** Unit spellings found in SEPA, grouped by the unit they mean. */
const UNIT_ALIASES: Record<string, string[]> = {
  g: ["gr", "gr.", "grm", "g", "grs", "grs.", "gramos", "grm.", "gm"],
  kg: ["kg", "kgm", "kgr", "kg.", "kilo", "kgs"],
  ml: ["ml", "ml.", "cm3", "cc.", "cc", "cmq", "c3"],
  l: ["l", "lt", "lt.", "ltr", "lts", "litro", "litros", "l."],
  unit: [
    "uni",
    "ea",
    "ud",
    "unidad",
    "un.",
    "uni.",
    "un",
    "u",
    "und",
    "unid",
    "unid.",
    "u.",
    "paquete",
    "pack",
    "cu",
    "unida",
  ],
};

const UNIT_BY_ALIAS = new Map<string, string>(
  Object.entries(UNIT_ALIASES).flatMap(([unit, aliases]) => aliases.map((alias) => [alias, unit] as const)),
);

export interface Presentation {
  quantity: number;
  unit: "g" | "ml" | "unit";
}

/** Quantity and unit exactly as a chain reports them. */
export interface RawPresentation {
  quantity: string;
  unit: string;
}

/** Quantity and unit converted to g, ml or unit; null if it cannot be interpreted. */
export function normalizePresentation(raw: RawPresentation): Presentation | null {
  let unit = UNIT_BY_ALIAS.get(raw.unit.trim().toLowerCase());
  let quantity = parseNumber(raw.quantity);
  if (!unit || quantity === null || quantity <= 0) return null;
  if (unit === "kg") [quantity, unit] = [quantity * 1000, "g"];
  if (unit === "l") [quantity, unit] = [quantity * 1000, "ml"];
  return { quantity: round2(quantity), unit: unit as Presentation["unit"] };
}

/**
 * The presentation most chains agree on. A generic "1 unit" is ignored
 * when some chain reports a weight or volume.
 */
export function pickPresentation(variants: RawPresentation[]): Presentation | null {
  const counts = new Map<string, { presentation: Presentation; count: number }>();
  for (const variant of variants) {
    const presentation = normalizePresentation(variant);
    if (!presentation) continue;
    const key = `${presentation.quantity}|${presentation.unit}`;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { presentation, count: 1 });
  }
  const all = [...counts.values()];
  const specific = all.filter(({ presentation: p }) => !(p.unit === "unit" && p.quantity === 1));
  return mostFrequent(specific.length ? specific : all, (entry) => entry.count)?.presentation ?? null;
}

/** The item with the highest score; the first one wins a tie. */
export function mostFrequent<T>(items: T[], score: (item: T) => number): T | undefined {
  let best: T | undefined;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore) [best, bestScore] = [item, s];
  }
  return best;
}
