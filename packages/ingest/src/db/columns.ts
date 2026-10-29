import type { Product } from "../domain/product.js";

/**
 * How a Product maps to the `products` table: [database column, Product key], in the order
 * used by the CSV and the COPY. Prices and boxes live in their own tables.
 */
export const PRODUCT_COLUMNS = [
  ["ean", "ean"],
  ["description", "description"],
  ["brand", "brand"],
  ["quantity", "quantity"],
  ["unit", "unit"],
  ["category", "category"],
  ["search_text", "searchText"],
  ["chains", "chains"],
  ["data_date", "dataDate"],
] as const satisfies readonly (readonly [string, keyof Product])[];

export const COLUMN_NAMES: string[] = PRODUCT_COLUMNS.map(([column]) => column);
