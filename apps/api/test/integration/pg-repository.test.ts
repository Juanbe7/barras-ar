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
    expect(typeof product?.retail?.median).toBe("number");
    expect(product?.retail?.dataDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("gives each channel its own price", async () => {
    // an Arcor chocolate bar sold by supermarkets and by wholesalers
    const both = await products.findByEan("7790580607418");
    expect(both?.retail?.median).toBeGreaterThan(0);
    expect(both?.wholesale?.median).toBeGreaterThan(0);
    expect(both?.wholesale?.median).not.toBe(both?.retail?.median);

    // a sun-care gel that only wholesalers carry
    const wholesaleOnly = await products.findByEan("7790375267766");
    expect(wholesaleOnly?.retail).toBeNull();
    expect(wholesaleOnly?.wholesale?.median).toBeGreaterThan(0);
  });

  it("reads the presentation of a wholesale-only product from its description", async () => {
    // "BAGOVIT SOLAR gel post solar 200 ml" has no quantity field anywhere
    const product = await products.findByEan("7790375267766");
    expect(product).toMatchObject({ quantity: 200, unit: "ml" });
  });

  it("resolves a wholesale box code to its product and the units inside", async () => {
    const match = await products.findByBoxCode("57790060023689");
    expect(match?.product.ean).toBe("7790060023684");
    expect(match?.units).toBe(12);
    expect(await products.findByBoxCode("57790060023690")).toBeNull();
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

  it("finds related products for a code that is not in the catalog", async () => {
    // a Saphirus air freshener missing from SEPA; its neighbours are Saphirus products of the same line
    expect(await products.findByEan("7798184680905")).toBeNull();
    const related = await products.findRelated("7798184680905", 8);
    expect(related.length).toBeGreaterThanOrEqual(5);
    expect(related.every((p) => p.ean.startsWith("779818468"))).toBe(true);
    expect(related.every((p) => p.brand === "SAPHIRUS")).toBe(true);
  });

  it("ranks the closest codes first and never returns the code itself", async () => {
    const related = await products.findRelated("7798184680912", 10);
    expect(related.map((p) => p.ean)).not.toContain("7798184680912");
    const distance = (ean: string) => Math.abs(Number(ean.slice(0, 12)) - Number("779818468091"));
    // among codes sharing the same prefix length, the nearer item number comes first
    const sharing11 = related.filter((p) => p.ean.startsWith("77981846809"));
    expect(sharing11.map((p) => distance(p.ean))).toEqual(
      [...sharing11.map((p) => distance(p.ean))].sort((a, b) => a - b),
    );
    expect(related.length).toBeLessThanOrEqual(10);
  });

  it("returns nothing for zero-padded short codes, whose prefix names no manufacturer", async () => {
    // EAN-8 / in-store codes: 0000077988256 is a real product, yet its neighbours would be noise
    expect(await products.findRelated("0000077988256", 8)).toEqual([]);
    expect(await products.findRelated("0000000000000", 8)).toEqual([]);
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
