import type { Variant } from "../domain/description.js";
import { isBoxCode, isValidEan, normalizeEan } from "../domain/ean.js";
import type { ProductSource } from "../domain/product.js";
import { cleanDescription, parseNumber } from "../domain/text.js";
import { mostFrequent } from "../domain/units.js";
import type { ProductRow } from "./reader.js";

const emptySource = (): ProductSource => ({
  variants: [],
  prices: { retail: new Map(), wholesale: new Map() },
  boxes: new Map(),
});

/**
 * Groups the rows of every channel by barcode. Of each chain only the variant
 * (description, brand, presentation) most repeated across its branches is kept.
 * Rows that are not real EANs or fail the check digit are dropped.
 */
export async function aggregateProducts(
  rows: AsyncIterable<ProductRow>,
): Promise<Map<string, ProductSource>> {
  const variantsByChain = new Map<string, Map<string, { variant: Variant; count: number }>>();
  const products = new Map<string, ProductSource>();
  const boxOwners = new Map<string, Set<string>>();

  const productOf = (ean: string) => {
    let product = products.get(ean);
    if (!product) products.set(ean, (product = emptySource()));
    return product;
  };

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

    const chainKey = `${ean}|${row.channel}|${row.chainId}`;
    let variants = variantsByChain.get(chainKey);
    if (!variants) variantsByChain.set(chainKey, (variants = new Map()));
    const seen = variants.get(variantKey);
    if (seen) seen.count++;
    else variants.set(variantKey, { variant, count: 1 });

    const product = productOf(ean);
    const price = parseNumber(row.listPrice);
    if (price !== null) {
      const byChain = product.prices[row.channel];
      const prices = byChain.get(row.chainId);
      if (prices) prices.push(price);
      else byChain.set(row.chainId, [price]);
    }

    const units = parseNumber(row.boxUnits);
    if (isBoxCode(row.boxCode, ean) && units !== null && Number.isInteger(units) && units > 1) {
      const reported = product.boxes.get(row.boxCode) ?? new Map<number, number>();
      reported.set(units, (reported.get(units) ?? 0) + 1);
      product.boxes.set(row.boxCode, reported);
      const owners = boxOwners.get(row.boxCode) ?? new Set<string>();
      boxOwners.set(row.boxCode, owners.add(ean));
    }
  }

  for (const [chainKey, variants] of variantsByChain) {
    const chosen = mostFrequent([...variants.values()], (entry) => entry.count);
    if (chosen) productOf(chainKey.slice(0, chainKey.indexOf("|"))).variants.push(chosen.variant);
  }

  // a box code declared for two different products cannot be trusted for either
  for (const [dun14, owners] of boxOwners) {
    if (owners.size > 1) for (const ean of owners) products.get(ean)?.boxes.delete(dun14);
  }
  return products;
}
