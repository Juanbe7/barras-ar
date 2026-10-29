import type { ProductRecord } from "./repository.js";

/** Credit the SEPA source requires (CC BY 4.0); it travels in every response. */
export const SOURCE = "Precios Claros – Base SEPA (CC BY 4.0)";

export interface ApiProduct {
  ean: string;
  description: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  reference_price: { median: number; min: number; max: number; date: string } | null;
  chains: number;
  first_seen: string;
  last_seen: string;
}

/** The public shape of a product (snake_case, like the rest of the JSON). */
export function toApiProduct(p: ProductRecord): ApiProduct {
  const hasPrice = p.priceMedian !== null && p.priceMin !== null && p.priceMax !== null;
  return {
    ean: p.ean,
    description: p.description,
    brand: p.brand,
    quantity: p.quantity,
    unit: p.unit,
    category: p.category,
    reference_price: hasPrice
      ? { median: p.priceMedian!, min: p.priceMin!, max: p.priceMax!, date: p.dataDate }
      : null,
    chains: p.chains,
    first_seen: p.firstSeen,
    last_seen: p.lastSeen,
  };
}
