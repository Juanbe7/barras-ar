import type { Variant } from "../domain/description.js";
import { isValidEan, normalizeEan } from "../domain/ean.js";
import type { ProductSource } from "../domain/product.js";
import { cleanDescription, parseNumber } from "../domain/text.js";
import { mostFrequent } from "../domain/units.js";
import type { ProductRow } from "./reader.js";

/**
 * Groups the rows by barcode and chain. Of each chain only the variant
 * (description, brand, presentation) most repeated across its branches is kept.
 * Rows that are not real EANs or fail the check digit are dropped.
 */
export async function aggregateProducts(
  rows: AsyncIterable<ProductRow>,
): Promise<Map<string, ProductSource>> {
  const variantsByChain = new Map<string, Map<string, { variant: Variant; count: number }>>();
  const pricesByEan = new Map<string, Map<string, number[]>>();

  for await (const row of rows) {
    if (!row.isEan || !isValidEan(row.code)) continue;
    const ean = normalizeEan(row.code);
    const variant: Variant = {
      description: cleanDescription(row.description),
      brand: row.brand,
      quantity: row.quantity,
      unit: row.unit,
    };
    const variantKey = [variant.description, variant.brand, variant.quantity, variant.unit].join("\u0000");

    const chainKey = `${ean}|${row.chainId}`;
    let variants = variantsByChain.get(chainKey);
    if (!variants) variantsByChain.set(chainKey, (variants = new Map()));
    const seen = variants.get(variantKey);
    if (seen) seen.count++;
    else variants.set(variantKey, { variant, count: 1 });

    const price = parseNumber(row.listPrice);
    if (price !== null) {
      let byChain = pricesByEan.get(ean);
      if (!byChain) pricesByEan.set(ean, (byChain = new Map()));
      const prices = byChain.get(row.chainId);
      if (prices) prices.push(price);
      else byChain.set(row.chainId, [price]);
    }
  }

  const products = new Map<string, ProductSource>();
  for (const [chainKey, variants] of variantsByChain) {
    const ean = chainKey.slice(0, chainKey.indexOf("|"));
    let product = products.get(ean);
    if (!product) products.set(ean, (product = { variants: [], prices: pricesByEan.get(ean) ?? new Map() }));
    const chosen = mostFrequent([...variants.values()], (entry) => entry.count);
    if (chosen) product.variants.push(chosen.variant);
  }
  return products;
}
