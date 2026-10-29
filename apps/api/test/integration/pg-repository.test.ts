import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool } from "../../src/db.js";
import { PgProductRepository } from "../../src/products/repository.js";

// Runs against a real catalog (a database loaded with the SEPA days of 23 and 29 October 2026).
// Use `npm run test:integration`; without DATABASE_URL these tests are skipped.
describe.skipIf(!process.env.DATABASE_URL)("PgProductRepository", () => {
  let pool: pg.Pool;
  let products: PgProductRepository;

  beforeAll(() => {
    pool = createPool();
    products = new PgProductRepository(() => pool);
  });
  afterAll(() => pool.end());

  it("finds a product by barcode with typed fields", async () => {
    const product = await products.findByEan("7790040147720");
    expect(product).toMatchObject({
      ean: "7790040147720",
      brand: "BAGLEY",
      quantity: 400,
      unit: "g",
      lastSeen: "2026-10-29",
    });
    expect(typeof product?.priceMedian).toBe("number");
  });

  it("returns null for an unknown barcode", async () => {
    expect(await products.findByEan("0000000000000")).toBeNull();
  });

  it("searches partial words and puts the most widespread product first", async () => {
    const page = await products.search(["surtid", "bagley"], 5, 0);
    expect(page.items[0]?.ean).toBe("7790040147720");
    expect(page.items.every((p) => p.description.toLowerCase().includes("bagley"))).toBe(true);
  });

  it("pages the results", async () => {
    const first = await products.search(["galletitas"], 3, 0);
    const second = await products.search(["galletitas"], 3, 3);
    expect(first.items).toHaveLength(3);
    expect(first.hasMore).toBe(true);
    expect(second.items[0]?.ean).not.toBe(first.items[0]?.ean);
  });

  it("reports the catalog size and the latest day", async () => {
    const stats = await products.stats();
    expect(stats.products).toBeGreaterThan(70_000);
    expect(stats.latestDataDate).toBe("2026-10-29");
  });

  it("answers a ping", async () => {
    await expect(products.ping()).resolves.toBeUndefined();
  });
});
