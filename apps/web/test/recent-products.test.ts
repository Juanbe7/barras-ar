import { describe, expect, it } from "vitest";
import { createRecentProducts } from "../src/storage/recent-products";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

const product = (ean: string) => ({ ean, description: `Producto ${ean}`, price: 100 });

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

  it("ignores corrupt data", () => {
    expect(createRecentProducts(fakeStorage({ "barras-ar:recent": "{no es json" })).list()).toEqual([]);
    expect(createRecentProducts(fakeStorage({ "barras-ar:recent": '[{"ean":1}]' })).list()).toEqual([]);
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
