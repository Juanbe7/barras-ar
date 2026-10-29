import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/create-app.js";
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

class FakeProducts implements ProductRepository {
  searches: { words: string[]; limit: number; offset: number }[] = [];
  relatedAsked: { ean: string; limit: number }[] = [];
  reachable = true;

  async findByEan(ean: string) {
    return ean === bagley.ean ? bagley : null;
  }
  async search(words: string[], limit: number, offset: number) {
    this.searches.push({ words, limit, offset });
    return { items: [bagley], hasMore: true };
  }
  async findByBoxCode(dun14: string) {
    return dun14 === "57790040147725" ? { product: bagley, units: 12 } : null;
  }
  async findRelated(ean: string, limit: number) {
    this.relatedAsked.push({ ean, limit });
    return [bagley];
  }
  async stats() {
    return { products: 77207, latestDataDate: "2026-10-29" };
  }
  async ping() {
    if (!this.reachable) throw new Error("down");
  }
}

let products: FakeProducts;
const appWith = (limit = 1000) =>
  createApp({ products, rateLimiter: new FixedWindowRateLimiter(limit, 60_000) });

beforeEach(() => {
  products = new FakeProducts();
});
afterEach(() => vi.restoreAllMocks());

describe("GET /products/:ean", () => {
  it("returns the product with both prices and the source credit", async () => {
    const res = await appWith().request("/products/7790040147720");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ean: "7790040147720",
      description: "GALLETITAS SURTIDO BAGLEY BOLSA X 400 GRS",
      brand: "BAGLEY",
      quantity: 400,
      unit: "g",
      category: null,
      reference_price: { median: 3850, min: 2500, max: 3985, date: "2026-10-29" },
      wholesale_price: { median: 2900, min: 2700, max: 3100, date: "2026-10-29" },
      chains: 7,
      first_seen: "2026-10-23",
      last_seen: "2026-10-29",
      source: SOURCE,
    });
  });

  it("finds a code written without its leading zeros", async () => {
    products.findByEan = async (ean) => (ean === "0000073513537" ? { ...bagley, ean } : null);
    const res = await appWith().request("/products/73513537");
    expect(res.status).toBe(200);
  });

  it("answers 404 for an unknown code", async () => {
    const res = await appWith().request("/products/7790000000000");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("answers 400 for something that is not a barcode", async () => {
    for (const bad of ["abc", "123", "77900401477201234567"]) {
      const res = await appWith().request(`/products/${bad}`);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("invalid_ean");
    }
  });

  it("can be cached at the edge", async () => {
    const res = await appWith().request("/products/7790040147720");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage");
  });

  it("has no price for a channel that does not report the product", async () => {
    products.findByEan = async () => ({ ...bagley, retail: null });
    const body = await (await appWith().request("/products/7790040147720")).json();
    expect(body.reference_price).toBeNull();
    expect(body.wholesale_price).toEqual({ median: 2900, min: 2700, max: 3100, date: "2026-10-29" });

    products.findByEan = async () => ({ ...bagley, retail: null, wholesale: null });
    const bare = await (await appWith().request("/products/7790040147720")).json();
    expect([bare.reference_price, bare.wholesale_price]).toEqual([null, null]);
  });

  it("does not add a pack to a unit's own code", async () => {
    const body = await (await appWith().request("/products/7790040147720")).json();
    expect(body).not.toHaveProperty("pack");
  });
});

describe("GET /products/:code with a box code (DUN-14)", () => {
  it("resolves the box to its product and says how many units it holds", async () => {
    const res = await appWith().request("/products/57790040147725");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ean).toBe("7790040147720");
    expect(body.pack).toEqual({ code: "57790040147725", units: 12 });
    expect(body.source).toBe(SOURCE);
  });

  it("answers 404 for a 14-digit code that is not a known box", async () => {
    const res = await appWith().request("/products/57790040147999");
    expect(res.status).toBe(404);
  });

  it("still treats a 14-digit code with a leading zero as the unit's barcode", async () => {
    const res = await appWith().request("/products/07790040147720");
    expect(res.status).toBe(200);
    expect((await res.json()).pack).toBeUndefined();
  });

  it("gives no related products for a box code", async () => {
    const res = await appWith().request("/products/57790040147725/related");
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
    expect(products.relatedAsked).toEqual([]);
  });
});

describe("GET /products?q=", () => {
  it("searches with the words of the query and paginates", async () => {
    const res = await appWith().request("/products?q=Galletitas%20BAGLEY&limit=5&offset=10");
    expect(res.status).toBe(200);
    expect(products.searches).toEqual([{ words: ["galletitas", "bagley"], limit: 5, offset: 10 }]);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body).toMatchObject({ limit: 5, offset: 10, has_more: true, source: SOURCE });
  });

  it("uses a default page size", async () => {
    await appWith().request("/products?q=bagley");
    expect(products.searches[0]).toMatchObject({ limit: 20, offset: 0 });
  });

  it("rejects a missing or empty query", async () => {
    for (const url of ["/products", "/products?q=", "/products?q=%20!!"]) {
      const res = await appWith().request(url);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("invalid_query");
    }
  });

  it("rejects out-of-range paging parameters", async () => {
    for (const qs of ["limit=0", "limit=51", "limit=abc", "offset=-1", "offset=10001"]) {
      const res = await appWith().request(`/products?q=bagley&${qs}`);
      expect(res.status).toBe(400);
    }
  });
});

describe("GET /products/:ean/related", () => {
  it("returns the related products with the code as the catalog stores it", async () => {
    const res = await appWith().request("/products/7798184680905/related");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ean: "7798184680905", source: SOURCE });
    expect(body.data).toHaveLength(1);
    expect(body.data[0].ean).toBe("7790040147720");
    expect(products.relatedAsked).toEqual([{ ean: "7798184680905", limit: 8 }]);
  });

  it("answers for a code that is not in the catalog (that is its purpose)", async () => {
    const res = await appWith().request("/products/7790000000000/related");
    expect(res.status).toBe(200);
  });

  it("pads a short code to 13 digits", async () => {
    await appWith().request("/products/73513537/related");
    expect(products.relatedAsked[0]?.ean).toBe("0000073513537");
  });

  it("takes a limit and rejects out-of-range ones", async () => {
    await appWith().request("/products/7798184680905/related?limit=3");
    expect(products.relatedAsked[0]?.limit).toBe(3);
    for (const bad of ["0", "21", "abc"]) {
      const res = await appWith().request(`/products/7798184680905/related?limit=${bad}`);
      expect(res.status).toBe(400);
    }
  });

  it("answers 400 for something that is not a barcode", async () => {
    const res = await appWith().request("/products/abc/related");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_ean");
  });

  it("can be cached at the edge", async () => {
    const res = await appWith().request("/products/7798184680905/related");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage");
  });
});

describe("GET /stats", () => {
  it("returns the catalog size and latest data day", async () => {
    const res = await appWith().request("/stats");
    expect(await res.json()).toEqual({ products: 77207, latest_data_date: "2026-10-29", source: SOURCE });
  });
});

describe("GET /health", () => {
  it("is ok when the database answers", async () => {
    const res = await appWith().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("is 503 when it does not", async () => {
    products.reachable = false;
    expect((await appWith().request("/health")).status).toBe(503);
  });
});

describe("the rest of the API", () => {
  it("serves the OpenAPI document", async () => {
    const res = await appWith().request("/openapi.json");
    expect((await res.json()).paths).toHaveProperty("/products/{ean}");
  });

  it("answers JSON for unknown routes", async () => {
    const res = await appWith().request("/nope");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("allows cross-origin reads", async () => {
    const res = await appWith().request("/health", { headers: { Origin: "https://example.com" } });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("answers 500 as JSON without leaking details when the repository fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    products.findByEan = async () => {
      throw new Error("password authentication failed for user postgres");
    };
    const res = await appWith().request("/products/7790040147720");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("password");
  });
});

describe("rate limit", () => {
  it("blocks a client over the limit and reports the quota in headers", async () => {
    const app = appWith(2);
    const headers = { "x-forwarded-for": "203.0.113.7, 10.0.0.1" };
    const first = await app.request("/health", { headers });
    expect(first.headers.get("RateLimit-Remaining")).toBe("1");
    await app.request("/health", { headers });
    const blocked = await app.request("/health", { headers });
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).error.code).toBe("rate_limited");
  });

  it("counts each client separately", async () => {
    const app = appWith(1);
    await app.request("/health", { headers: { "x-forwarded-for": "203.0.113.7" } });
    const other = await app.request("/health", { headers: { "x-forwarded-for": "203.0.113.8" } });
    expect(other.status).toBe(200);
  });
});
