import type { ProductRecord, ProductRepository } from "./repository.js";

/** The catalog's form of a barcode (13 digits, leading zeros), or null if it is not 8 to 14 digits. */
export function toCatalogEan(code: string): string | null {
  return /^\d{8,14}$/.test(code) ? code.replace(/^0+/, "").padStart(13, "0") : null;
}

export type EanLookup =
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "found"; record: ProductRecord; pack?: { code: string; units: number } };

/**
 * Looks a barcode up the way `GET /products/{code}` does, shared with the batch endpoint so both
 * answer identically: a 13-digit code is a unit's own barcode; a 14-digit code may instead be the
 * wholesale box (DUN-14) that holds it, in which case `pack` says how many units it has.
 */
export async function lookupEan(products: ProductRepository, code: string): Promise<EanLookup> {
  const ean = toCatalogEan(code);
  if (!ean) return { kind: "invalid" };

  const product = ean.length === 13 ? await products.findByEan(ean) : null;
  if (product) return { kind: "found", record: product };

  const box = code.length === 14 ? await products.findByBoxCode(code) : null;
  if (box) return { kind: "found", record: box.product, pack: { code, units: box.units } };

  return { kind: "not_found" };
}
