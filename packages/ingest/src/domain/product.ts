import { pickBrand, pickDescription, type Variant } from "./description.js";
import { round2, searchWords } from "./text.js";
import { pickPresentation } from "./units.js";

/** Everything the ingestion gathered about one barcode in a single day. */
export interface ProductSource {
  /** one variant per chain */
  variants: Variant[];
  /** list prices per chain, one per branch */
  prices: Map<string, number[]>;
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
  priceMedian: number | null;
  priceMin: number | null;
  priceMax: number | null;
  /** in how many chains the code appears */
  chains: number;
  /** day of the data this record was computed from */
  dataDate: string;
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function buildProduct(ean: string, source: ProductSource, dataDate: string): Product {
  const { variants } = source;
  const brand = pickBrand(variants);
  const description = pickDescription(variants, brand);
  const presentation = pickPresentation(variants);

  // every chain's wording goes into the search text, so "bagley surtido" and "surtidas bagley" both match
  const words = new Set<string>();
  for (const text of [description, ...variants.map((v) => v.description), brand]) {
    for (const word of searchWords(text)) words.add(word);
  }

  const chainMedians = [...source.prices.values()].filter((p) => p.length > 0).map(median);
  const hasPrice = chainMedians.length > 0;
  return {
    ean,
    description,
    brand,
    quantity: presentation?.quantity ?? null,
    unit: presentation?.unit ?? null,
    category: null,
    searchText: [...words].join(" "),
    priceMedian: hasPrice ? round2(median(chainMedians)) : null,
    priceMin: hasPrice ? round2(Math.min(...chainMedians)) : null,
    priceMax: hasPrice ? round2(Math.max(...chainMedians)) : null,
    chains: variants.length,
    dataDate,
  };
}
