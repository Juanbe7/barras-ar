import { COLUMN_NAMES, PRODUCT_COLUMNS } from "../db/columns.js";
import type { Product } from "../domain/product.js";

export const CSV_HEADER = COLUMN_NAMES.join(",") + "\n";

const cell = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** One CSV line per product, in the column order of the `products` table. Empty cells are NULL. */
export function* csvLines(products: Iterable<Product>): Generator<string> {
  for (const product of products) {
    yield PRODUCT_COLUMNS.map(([, key]) => cell(product[key])).join(",") + "\n";
  }
}
