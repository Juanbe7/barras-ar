/** Response shapes of the BarrasAR API (see apps/api/src/products/presenter.ts). */

export interface ReferencePrice {
  median: number;
  min: number;
  max: number;
  /** ISO day (YYYY-MM-DD) of the data the price comes from. */
  date: string;
}

export interface Product {
  ean: string;
  description: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  /** Supermarket price. */
  reference_price: ReferencePrice | null;
  /** Wholesale price: an approximate cost for a shop that buys to resell. Absent in older API versions. */
  wholesale_price?: ReferencePrice | null;
  chains: number;
  first_seen: string;
  last_seen: string;
}

/** The box a wholesale code (DUN-14) belongs to, when the code that was asked for is a box. */
export interface Pack {
  code: string;
  /** Units of the product inside the box. */
  units: number;
}

export interface ProductDetail extends Product {
  pack?: Pack;
  source: string;
}

export interface SearchPage {
  data: Product[];
  limit: number;
  offset: number;
  has_more: boolean;
  source: string;
}

export interface RelatedResponse {
  /** The code the products are related to, as the catalog stores it. */
  ean: string;
  data: Product[];
  source: string;
}
