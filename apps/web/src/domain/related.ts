import type { Product } from "../api/types";

export interface RelatedHeading {
  title: string;
  note: string;
}

const MIN_FOR_BRAND_CLAIM = 3;

/** The brand when most of the products share it; claiming "same brand" for a mixed list would mislead. */
function dominantBrand(products: Product[]): string | null {
  const counts = new Map<string, number>();
  for (const { brand } of products) {
    const key = brand?.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top && products.length >= MIN_FOR_BRAND_CLAIM && top[1] > products.length / 2 ? top[0] : null;
}

/**
 * The heading of the list shown for a code that is not in the catalog. It must never read as the
 * product that was scanned, so the note always says so.
 */
export function describeRelated(products: Product[]): RelatedHeading {
  if (dominantBrand(products)) {
    return {
      title: "Productos parecidos de la misma marca",
      note: "No es el producto que escaneaste.",
    };
  }
  return {
    title: "Productos relacionados",
    note: "Del mismo fabricante. No es el producto que escaneaste.",
  };
}
