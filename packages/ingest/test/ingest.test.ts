import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isValidEan } from "../src/domain/ean.js";
import { buildProduct, median } from "../src/domain/product.js";
import { CSV_HEADER, csvLines } from "../src/export/csv.js";
import { aggregateProducts } from "../src/source/aggregate.js";
import { readProducts, zipDate, type ZipNotice } from "../src/source/reader.js";

const MINI_ZIP = fileURLToPath(new URL("./fixtures/sepa-mini.zip", import.meta.url));

describe("readProducts", () => {
  it("reads the good chains and reports the empty and the corrupt ones without stopping", async () => {
    const notices: ZipNotice[] = [];
    let rows = 0;
    for await (const row of readProducts(MINI_ZIP, (n) => notices.push(n))) {
      rows++;
      expect(row.code).not.toBe("");
    }
    expect(rows).toBeGreaterThan(0);
    const filesWith = (status: ZipNotice["status"]) =>
      notices.filter((n) => n.status === status).map((n) => n.file);
    expect(filesWith("ok")).toHaveLength(3);
    expect(filesWith("empty")).toEqual([expect.stringContaining("comercio-sepa-36")]);
    expect(filesWith("error")).toEqual([expect.stringContaining("comercio-sepa-99")]);
  });

  it("drops the trailing 'Ultima actualizacion' line and leaves no BOM in the data", async () => {
    for await (const row of readProducts(MINI_ZIP)) {
      expect(row.chainId).toMatch(/^\d+$/);
      expect(row.description).not.toMatch(/Ultima actualizacion/i);
    }
  });
});

describe("zipDate", () => {
  it("reads the day from the folder name", async () => {
    expect(await zipDate(MINI_ZIP)).toBe("2026-10-29");
  });
});

describe("aggregateProducts + buildProduct", () => {
  it("builds a valid record for every barcode", async () => {
    const sources = await aggregateProducts(readProducts(MINI_ZIP));
    expect(sources.size).toBe(359);
    for (const [ean, source] of sources) {
      expect(ean).toMatch(/^\d{13}$/);
      expect(isValidEan(ean)).toBe(true);
      const product = buildProduct(ean, source, "2026-10-29");
      expect(product.description).not.toBe("");
      expect(product.chains).toBeGreaterThan(0);
      expect(product.searchText).toBe(product.searchText.toLowerCase());
      if (product.priceMedian !== null) {
        expect(product.priceMin!).toBeLessThanOrEqual(product.priceMedian);
        expect(product.priceMedian).toBeLessThanOrEqual(product.priceMax!);
      }
    }
  });

  it("drops internal codes (productos_ean = 0)", async () => {
    const sources = await aggregateProducts(readProducts(MINI_ZIP));
    // 0000000023897 is an internal code of chain 3 and must not get in
    expect(sources.has("0000000023897")).toBe(false);
  });
});

describe("csvLines", () => {
  it("writes one line per product, with NULL as an empty cell and quotes escaped", () => {
    const [line] = csvLines([
      {
        ean: "7790040147720",
        description: 'LECHE "ENTERA", 1 L',
        brand: "",
        quantity: 1000,
        unit: "ml",
        category: null,
        searchText: "leche entera 1 l",
        priceMedian: 10,
        priceMin: 9,
        priceMax: 11,
        chains: 3,
        dataDate: "2026-10-29",
      },
    ]);
    expect(line).toBe(
      '7790040147720,"LECHE ""ENTERA"", 1 L",,1000,ml,,leche entera 1 l,10,9,11,3,2026-10-29\n',
    );
    expect(CSV_HEADER.trim().split(",")).toHaveLength(12);
  });
});

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("refuses an empty list", () => {
    expect(() => median([])).toThrow();
  });
});
