import type { Product } from "../domain/product.js";

/**
 * Single source of truth for how a Product maps to the `products` table:
 * [database column, Product key], in the order used by the CSV and the COPY.
 */
export const PRODUCT_COLUMNS = [
  ["ean", "ean"],
  ["description", "description"],
  ["brand", "brand"],
  ["quantity", "quantity"],
  ["unit", "unit"],
  ["category", "category"],
  ["search_text", "searchText"],
  ["price_median", "priceMedian"],
  ["price_min", "priceMin"],
  ["price_max", "priceMax"],
  ["chains", "chains"],
  ["data_date", "dataDate"],
] as const satisfies readonly (readonly [string, keyof Product])[];

export const COLUMN_NAMES: string[] = PRODUCT_COLUMNS.map(([column]) => column);
