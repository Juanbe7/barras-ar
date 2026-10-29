import { pickBrand, pickDescription, type Variant } from "./description.js";
import { presentationFromText } from "./presentation-text.js";
import { round2, searchWords } from "./text.js";
import { pickPresentation, type Presentation } from "./units.js";

/** Where a price comes from: supermarkets (retail) or wholesalers with a sales floor. */
export type Channel = "retail" | "wholesale";

/** Everything the ingestion gathered about one barcode in a single run. */
export interface ProductSource {
  /** one variant per chain, retail and wholesale together */
  variants: Variant[];
  /** list prices (with VAT, per unit) per channel and chain, one per branch */
  prices: Record<Channel, Map<string, number[]>>;
  /** wholesale boxes of this product: DUN-14 code -> units per box -> times reported */
  boxes: Map<string, Map<number, number>>;
}

/** National list price of one channel (promotions excluded): median of each chain's median, plus min and max. */
export interface ReferencePrice {
  channel: Channel;
  median: number;
  min: number;
  max: number;
  /** chains of this channel behind the price */
  chains: number;
  /** day of the file the price comes from */
  dataDate: string;
}

/** A box of this product, identified by its DUN-14 code. */
export interface BulkUnit {
  dun14: string;
  units: number;
}

/** The catalog record for one barcode. */
export interface Product {
  ean: string;
  description: string;
  brand: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  searchText: string;
  /** in how many chains the code appears, retail and wholesale */
  chains: number;
  /** day of the data this record was computed from */
  dataDate: string;
  prices: ReferencePrice[];
  bulkUnits: BulkUnit[];
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * The presentation the chains report. When they report none (wholesale files have no such field) or only a
 * generic "1 unit", the one written in the description.
 *
 * A written weight or volume replaces either; a written count ("X 6 UNI") only fills in a missing presentation.
 * Measured on the catalog, a written g/ml agrees with the chains' own figure 91% of the time, but a count only 74%:
 * chains often report the net weight (250 g) of a pack whose description counts pieces ("X 2 UNI").
 */
function pickProductPresentation(variants: Variant[], description: string): Presentation | null {
  const reported = pickPresentation(variants);
  const generic = !reported || (reported.unit === "unit" && reported.quantity === 1);
  if (!generic) return reported;
  for (const text of [description, ...variants.map((v) => v.description)]) {
    const written = presentationFromText(text);
    if (written && (written.unit !== "unit" || !reported)) return written;
  }
  return reported;
}

function referencePrice(
  channel: Channel,
  byChain: Map<string, number[]>,
  dataDate: string,
): ReferencePrice | null {
  const chainMedians = [...byChain.values()].filter((prices) => prices.length > 0).map(median);
  if (chainMedians.length === 0) return null;
  return {
    channel,
    median: round2(median(chainMedians)),
    min: round2(Math.min(...chainMedians)),
    max: round2(Math.max(...chainMedians)),
    chains: chainMedians.length,
    dataDate,
  };
}

/** The units per box most chains agree on; the first one wins a tie. */
function bulkUnit(dun14: string, reported: Map<number, number>): BulkUnit {
  let units = 0;
  let count = 0;
  for (const [candidate, times] of reported) if (times > count) [units, count] = [candidate, times];
  return { dun14, units };
}

/**
 * @param days the day of each channel's file; a channel without a day was not part of this run.
 *             The record's own day is the latest of them.
 */
export function buildProduct(
  ean: string,
  source: ProductSource,
  days: Partial<Record<Channel, string>>,
): Product {
  const dates = Object.values(days);
  const dataDate = dates.sort().at(-1);
  if (!dataDate) throw new Error("buildProduct needs the day of at least one channel");

  const { variants } = source;
  const brand = pickBrand(variants);
  const description = pickDescription(variants, brand);
  const presentation = pickProductPresentation(variants, description);

  // every chain's wording goes into the search text, so "bagley surtido" and "surtidas bagley" both match
  const words = new Set<string>();
  for (const text of [description, ...variants.map((v) => v.description), brand]) {
    for (const word of searchWords(text)) words.add(word);
  }

  const prices: ReferencePrice[] = [];
  for (const channel of ["retail", "wholesale"] as const) {
    const day = days[channel];
    const price = day ? referencePrice(channel, source.prices[channel], day) : null;
    if (price) prices.push(price);
  }

  return {
    ean,
    description,
    brand,
    quantity: presentation?.quantity ?? null,
    unit: presentation?.unit ?? null,
    category: null,
    searchText: [...words].join(" "),
    chains: variants.length,
    dataDate,
    prices,
    bulkUnits: [...source.boxes].map(([dun14, reported]) => bulkUnit(dun14, reported)),
  };
}
