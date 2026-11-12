import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/create-app.js";
import { BATCH_CONCURRENCY, MAX_BATCH_ITEMS } from "../src/products/batch.js";
import { SOURCE } from "../src/products/presenter.js";
import type { ProductRecord, ProductRepository } from "../src/products/repository.js";
import { FixedWindowRateLimiter } from "../src/rate-limit.js";

const bagley: ProductRecord = {
  ean: "7790040147720",
  description: "GALLETITAS SURTIDO BAGLEY BOLSA X 400 GRS",
  brand: "BAGLEY",
  quantity: 400,
  unit: "g",
  category: null,
  retail: { median: 3850, min: 2500, max: 3985, dataDate: "2026-10-29" },
  wholesale: { median: 2900, min: 2700, max: 3100, dataDate: "2026-10-29" },
  chains: 7,
  dataDate: "2026-10-29",
  firstSeen: "2026-10-23",
  lastSeen: "2026-10-29",
};

const milka: ProductRecord = {
  ...bagley,
  ean: "7622300457303",
  description: "ALFAJOR CHOCO. BLANCO MOUSSE TRIPLE, MILKA, 55 g",
  brand: "MILKA",
};

class FakeProducts implements ProductRepository {
  searches: { words: string[]; limit: number; offset: number }[] = [];
  inFlight = 0;
  maxInFlight = 0;
  delayMs = 0;

  async findByEan(ean: string) {
    if (ean === bagley.ean) return bagley;
    if (ean === milka.ean) return milka;
    return null;
  }
  async findByBoxCode(dun14: string) {
    return dun14 === "57790040147725" ? { product: bagley, units: 12 } : null;
  }
  async search(words: string[], limit: number, offset: number) {
    this.searches.push({ words, limit, offset });
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.inFlight--;
    if (words.includes("bagley")) return { items: [bagley], hasMore: false };
    if (words.includes("milka")) return { items: [milka, bagley], hasMore: false };
    return { items: [], hasMore: false };
  }
  async findRelated() {
    return [];
  }
  async stats() {
    return { products: 1, latestDataDate: "2026-10-29" };
  }
  async ping() {}
}

let products: FakeProducts;
const appWith = (limit = 1000) =>
  createApp({ products, rateLimiter: new FixedWindowRateLimiter(limit, 60_000) });

const post = (app: ReturnType<typeof appWith>, body: unknown, init: RequestInit = {}) =>
  app.request("/products/batch", {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...init,
  });

beforeEach(() => {
  products = new FakeProducts();
});
afterEach(() => vi.restoreAllMocks());

describe("POST /products/batch", () => {
  it("BB-01: a mixed batch answers one result per item, in order, with the source credit", async () => {
    const res = await post(appWith(), {
      items: [
        { id: "row-2", q: "galletitas bagley", limit: 3 },
        { id: "row-3", ean: "7622300457303" },
      ],
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe(SOURCE);
    expect(body.results.map((r: { id: string }) => r.id)).toEqual(["row-2", "row-3"]);
    expect(body.results[0]).toMatchObject({ id: "row-2", found: true });
    expect(body.results[1]).toMatchObject({ id: "row-3", found: true });
  });

  it("BB-02: a text item returns the same product shape as GET /products, capped by its limit", async () => {
    const body = await (await post(appWith(), { items: [{ id: "a", q: "alfajor milka", limit: 1 }] })).json();
    expect(products.searches[0]).toEqual({ words: ["alfajor", "milka"], limit: 1, offset: 0 });
    expect(body.results[0].data[0]).toMatchObject({
      ean: "7622300457303",
      brand: "MILKA",
      reference_price: { median: 3850, min: 2500, max: 3985, date: "2026-10-29" },
      wholesale_price: { median: 2900, min: 2700, max: 3100, date: "2026-10-29" },
      chains: 7,
    });
  });

  it("uses a default limit of 5 when the item has none", async () => {
    await post(appWith(), { items: [{ id: "a", q: "bagley" }] });
    expect(products.searches[0]?.limit).toBe(5);
  });

  it("BB-03: an item by barcode returns that one product, also when written without leading zeros", async () => {
    products.findByEan = async (ean) => (ean === "0000073513537" ? { ...bagley, ean } : null);
    const body = await (await post(appWith(), { items: [{ id: "a", ean: "73513537" }] })).json();
    expect(body.results[0]).toMatchObject({ id: "a", found: true });
    expect(body.results[0].data).toHaveLength(1);
    expect(body.results[0].data[0].ean).toBe("0000073513537");
  });

  it("a wholesale box code (DUN-14) answers with the product it holds plus `pack`, like GET /products/{code}", async () => {
    const body = await (await post(appWith(), { items: [{ id: "a", ean: "57790040147725" }] })).json();
    expect(body.results[0].found).toBe(true);
    expect(body.results[0].data[0]).toMatchObject({
      ean: "7790040147720",
      pack: { code: "57790040147725", units: 12 },
    });
  });

  it("BB-04: an item with no match is found:false with empty data and does not affect the others", async () => {
    const body = await (
      await post(appWith(), {
        items: [
          { id: "a", q: "producto inexistente zzz" },
          { id: "b", ean: "7790000000000" },
          { id: "c", q: "bagley" },
        ],
      })
    ).json();
    expect(body.results[0]).toEqual({ id: "a", found: false, data: [] });
    expect(body.results[1]).toEqual({ id: "b", found: false, data: [] });
    expect(body.results[2].found).toBe(true);
  });

  it("BB-05: an invalid item reports its own error and the rest of the batch is still answered", async () => {
    const body = await (
      await post(appWith(), {
        items: [
          { id: "bad-ean", ean: "abc" },
          { id: "empty" },
          { id: "both", q: "bagley", ean: "7790040147720" },
          { id: "bad-q", q: "!!!" },
          { id: "bad-limit", q: "bagley", limit: 99 },
          { id: "ok", q: "bagley" },
        ],
      })
    ).json();

    const codes = Object.fromEntries(
      body.results.map((r: { id: string; error?: { code: string } }) => [r.id, r.error?.code]),
    );
    expect(codes).toEqual({
      "bad-ean": "invalid_ean",
      empty: "invalid_item",
      both: "invalid_item",
      "bad-q": "invalid_query",
      "bad-limit": "invalid_limit",
      ok: undefined,
    });
    expect(
      body.results.every((r: { found: boolean; id: string }) => r.id === "ok" || r.found === false),
    ).toBe(true);
    expect(body.results.find((r: { id: string }) => r.id === "ok").found).toBe(true);
  });

  it("an over-long q is an item error, not a request error", async () => {
    const body = await (await post(appWith(), { items: [{ id: "a", q: "bagley ".repeat(60) }] })).json();
    expect(body.results[0].error.code).toBe("invalid_query");
  });

  it("BB-06: a repeated id rejects the request and names the id", async () => {
    const res = await post(appWith(), {
      items: [
        { id: "x", q: "bagley" },
        { id: "x", q: "milka" },
      ],
    });
    expect(res.status).toBe(400);
    const error = (await res.json()).error;
    expect(error.code).toBe("duplicate_id");
    expect(error.message).toContain('"x"');
    expect(products.searches).toHaveLength(0);
  });

  it("an item without a usable id rejects the request", async () => {
    for (const items of [
      [{ q: "bagley" }],
      [{ id: "", q: "bagley" }],
      [{ id: 7, q: "bagley" }],
      [{ id: "x".repeat(65), q: "a" }],
      ["bagley"],
    ]) {
      const res = await post(appWith(), { items });
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("invalid_id");
    }
  });

  it("BB-07: more than 100 items is rejected without looking anything up", async () => {
    const items = Array.from({ length: MAX_BATCH_ITEMS + 1 }, (_, i) => ({ id: `r${i}`, q: "bagley" }));
    const res = await post(appWith(), { items });
    expect(res.status).toBe(400);
    const error = (await res.json()).error;
    expect(error.code).toBe("batch_too_large");
    expect(error.message).toContain("100");
    expect(products.searches).toHaveLength(0);
  });

  it("exactly 100 items is accepted", async () => {
    const items = Array.from({ length: MAX_BATCH_ITEMS }, (_, i) => ({ id: `r${i}`, q: "bagley" }));
    const res = await post(appWith(), { items });
    expect(res.status).toBe(200);
    expect((await res.json()).results).toHaveLength(MAX_BATCH_ITEMS);
  });

  it("BB-08: an empty batch is a 400", async () => {
    const res = await post(appWith(), { items: [] });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_items");
  });

  it("BB-09: a body that is not JSON, or has no items, is a 400", async () => {
    const notJson = await post(appWith(), "{nope");
    expect(notJson.status).toBe(400);
    expect((await notJson.json()).error.code).toBe("invalid_json");

    for (const body of [{}, { items: "bagley" }, [], "null"]) {
      const res = await post(appWith(), body);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("invalid_body");
    }
  });

  it("a body over the size limit is a 413", async () => {
    const res = await post(appWith(), { items: [{ id: "a", q: "x".repeat(200 * 1024) }] });
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("payload_too_large");
  });

  it("BB-10: a batch of 100 items costs ONE hit of the rate limit", async () => {
    const app = appWith(2);
    const headers = { "x-forwarded-for": "203.0.113.7" };
    const items = Array.from({ length: MAX_BATCH_ITEMS }, (_, i) => ({ id: `r${i}`, q: "bagley" }));

    const first = await post(app, { items }, { headers });
    expect(first.status).toBe(200);
    expect(first.headers.get("RateLimit-Remaining")).toBe("1");

    expect((await post(app, { items }, { headers })).status).toBe(200);
    expect((await post(app, { items }, { headers })).status).toBe(429);
  });

  it("runs at most BATCH_CONCURRENCY lookups at the same time", async () => {
    products.delayMs = 5;
    const items = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, q: "bagley" }));
    await post(appWith(), { items });
    expect(products.maxInFlight).toBeGreaterThan(1);
    expect(products.maxInFlight).toBeLessThanOrEqual(BATCH_CONCURRENCY);
  });

  it("keeps the request's order even when the lookups finish out of order", async () => {
    const original = products.search.bind(products);
    products.search = async (words, limit, offset) => {
      if (words.includes("milka")) await new Promise((resolve) => setTimeout(resolve, 15));
      return original(words, limit, offset);
    };
    const body = await (
      await post(appWith(), {
        items: [
          { id: "slow", q: "milka" },
          { id: "fast", q: "bagley" },
        ],
      })
    ).json();
    expect(body.results.map((r: { id: string }) => r.id)).toEqual(["slow", "fast"]);
  });

  it("a repository failure on one item is reported on that item without leaking details, and the rest is answered", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const original = products.search.bind(products);
    products.search = async (words, limit, offset) => {
      if (words.includes("milka")) throw new Error("password authentication failed for user postgres");
      return original(words, limit, offset);
    };

    const res = await post(appWith(), {
      items: [
        { id: "boom", q: "milka" },
        { id: "ok", q: "bagley" },
      ],
    });
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("password");
    const body = JSON.parse(text);
    expect(body.results[0]).toMatchObject({ id: "boom", found: false, error: { code: "internal_error" } });
    expect(body.results[1].found).toBe(true);
  });

  it("is not cached at the edge", async () => {
    const res = await post(appWith(), { items: [{ id: "a", q: "bagley" }] });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("allows a cross-origin POST (preflight and request)", async () => {
    const app = appWith();
    const preflight = await app.request("/products/batch", {
      method: "OPTIONS",
      headers: {
        Origin: "https://example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const res = await post(
      app,
      { items: [{ id: "a", q: "bagley" }] },
      { headers: { Origin: "https://example.com" } },
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("the batch endpoint does not change the rest of the API", () => {
  it("BB-11: GET /products/:ean still answers a box code with `pack`", async () => {
    const res = await appWith().request("/products/57790040147725");
    expect(res.status).toBe(200);
    expect((await res.json()).pack).toEqual({ code: "57790040147725", units: 12 });
  });

  it("GET /products/batch is not the batch endpoint (it is a barcode lookup and fails as one)", async () => {
    const res = await appWith().request("/products/batch");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_ean");
  });

  it("BB-12: the OpenAPI document describes POST /products/batch", async () => {
    const doc = await (await appWith().request("/openapi.json")).json();
    expect(doc.paths["/products/batch"].post).toBeDefined();
    expect(doc.components.schemas).toHaveProperty("BatchRequest");
    expect(doc.components.schemas).toHaveProperty("BatchResponse");
  });
});
