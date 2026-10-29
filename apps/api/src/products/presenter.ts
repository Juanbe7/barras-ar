import type { PriceRecord, ProductRecord } from "./repository.js";

/** Credit the SEPA source requires (CC BY 4.0); it travels in every response. */
export const SOURCE = "Precios Claros – Base SEPA (CC BY 4.0)";

export interface ApiPrice {
  median: number;
  min: number;
  max: number;
  date: string;
}

export interface ApiProduct {
  ean: string;
  description: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  /** supermarket price */
  reference_price: ApiPrice | null;
  /** wholesale price: an approximate cost for a shop that buys to resell */
  wholesale_price: ApiPrice | null;
  chains: number;
  first_seen: string;
  last_seen: string;
}

const toApiPrice = (price: PriceRecord | null): ApiPrice | null =>
  price && { median: price.median, min: price.min, max: price.max, date: price.dataDate };

/** The public shape of a product (snake_case, like the rest of the JSON). */
export function toApiProduct(p: ProductRecord): ApiProduct {
  return {
    ean: p.ean,
    description: p.description,
    brand: p.brand,
    quantity: p.quantity,
    unit: p.unit,
    category: p.category,
    reference_price: toApiPrice(p.retail),
    wholesale_price: toApiPrice(p.wholesale),
    chains: p.chains,
    first_seen: p.firstSeen,
    last_seen: p.lastSeen,
  };
}
