import { describe, expect, it } from "vitest";
import { createRecentProducts, type RecentProduct } from "../src/storage/recent-products";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const product = (ean: string): RecentProduct => ({
  ean,
  description: `Producto ${ean}`,
  prices: { retail: 100, wholesale: 80 },
});

describe("recent products", () => {
  it("starts empty", () => {
    expect(createRecentProducts(fakeStorage()).list()).toEqual([]);
  });

  it("puts the latest first and does not repeat a product", () => {
    const recents = createRecentProducts(fakeStorage());
    recents.add(product("1"));
    recents.add(product("2"));
    recents.add(product("1"));
    expect(recents.list().map((p) => p.ean)).toEqual(["1", "2"]);
  });

  it("keeps only the last five", () => {
    const recents = createRecentProducts(fakeStorage());
    for (const ean of ["1", "2", "3", "4", "5", "6"]) recents.add(product(ean));
    expect(recents.list().map((p) => p.ean)).toEqual(["6", "5", "4", "3", "2"]);
  });

  it("keeps the price of each channel, including a missing one", () => {
    const recents = createRecentProducts(fakeStorage());
    recents.add({ ean: "1", description: "Solo mayorista", prices: { retail: null, wholesale: 80 } });
    expect(recents.list()[0]?.prices).toEqual({ retail: null, wholesale: 80 });
  });

  it("reads an entry saved before there were two prices as a supermarket price", () => {
    const old = JSON.stringify([{ ean: "7790040147720", description: "Surtido Bagley", price: 3850 }]);
    const recents = createRecentProducts(fakeStorage({ "barras-ar:recent": old }));
    expect(recents.list()).toEqual([
      { ean: "7790040147720", description: "Surtido Bagley", prices: { retail: 3850, wholesale: null } },
    ]);
  });

  it("ignores corrupt data and keeps the good entries", () => {
    expect(createRecentProducts(fakeStorage({ "barras-ar:recent": "{no es json" })).list()).toEqual([]);
    expect(createRecentProducts(fakeStorage({ "barras-ar:recent": '[{"ean":1}]' })).list()).toEqual([]);
    const mixed = JSON.stringify([{ ean: 1 }, { ean: "2", description: "Bueno", price: null }]);
    expect(createRecentProducts(fakeStorage({ "barras-ar:recent": mixed })).list()).toHaveLength(1);
  });

  it("survives a storage that refuses to write", () => {
    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => createRecentProducts(blocked).add(product("1"))).not.toThrow();
  });
});
