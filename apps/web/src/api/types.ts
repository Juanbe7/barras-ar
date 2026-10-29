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
  reference_price: ReferencePrice | null;
  chains: number;
  first_seen: string;
  last_seen: string;
}

export interface ProductDetail extends Product {
  source: string;
}

export interface SearchPage {
  data: Product[];
  limit: number;
  offset: number;
  has_more: boolean;
  source: string;
}
