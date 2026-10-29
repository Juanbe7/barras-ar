import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { openapi } from "./openapi.js";
import { SOURCE, toApiProduct } from "./products/presenter.js";
import type { ProductRepository } from "./products/repository.js";
import { parseSearchQuery } from "./products/search-query.js";
import type { RateLimiter } from "./rate-limit.js";

export interface AppDeps {
  products: ProductRepository;
  rateLimiter: RateLimiter;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 10_000;

// The catalog changes once a day, so responses can be cached at the edge; this also spares the database.
const CACHE_PRODUCT = "public, s-maxage=3600, stale-while-revalidate=86400";
const CACHE_NOT_FOUND = "public, s-maxage=300";
const CACHE_STATS = "public, s-maxage=300";

function fail(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

/** An integer query parameter within [min, max]; undefined if it is absent, null if it is invalid. */
function intParam(value: string | undefined, min: number, max: number): number | undefined | null {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

function clientKey(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || c.req.header("x-real-ip") || "unknown";
}

/** Registers the API on `app` (a new Hono instance unless one is given) and returns it. */
export function createApp({ products, rateLimiter }: AppDeps, app: Hono = new Hono()): Hono {
  app.use(cors({ origin: "*", allowMethods: ["GET"] }));

  app.use(async (c, next) => {
    const result = rateLimiter.hit(clientKey(c));
    c.header("RateLimit-Limit", String(result.limit));
    c.header("RateLimit-Remaining", String(result.remaining));
    c.header("RateLimit-Reset", String(result.resetAt));
    if (!result.allowed) return fail(c, 429, "rate_limited", "Too many requests, try again in a minute.");
    await next();
  });

  app.get("/", (c) =>
    c.json({
      name: "BarrasAR",
      description: "Open API of Argentine products by barcode.",
      docs: "/openapi.json",
      source: SOURCE,
    }),
  );

  app.get("/openapi.json", (c) => c.json(openapi));

  app.get("/health", async (c) => {
    try {
      await products.ping();
      return c.json({ status: "ok" });
    } catch {
      return c.json({ status: "unavailable" }, 503);
    }
  });

  app.get("/stats", async (c) => {
    const stats = await products.stats();
    c.header("Cache-Control", CACHE_STATS);
    return c.json({ products: stats.products, latest_data_date: stats.latestDataDate, source: SOURCE });
  });

  app.get("/products/:ean", async (c) => {
    const code = c.req.param("ean");
    if (!/^\d{8,14}$/.test(code)) {
      return fail(c, 400, "invalid_ean", "The barcode must have 8 to 14 digits.");
    }
    // the catalog stores every code as 13 digits with leading zeros
    const ean = code.replace(/^0+/, "").padStart(13, "0");
    const product = await products.findByEan(ean);
    if (!product) {
      c.header("Cache-Control", CACHE_NOT_FOUND);
      return fail(c, 404, "not_found", "No product with that barcode.");
    }
    c.header("Cache-Control", CACHE_PRODUCT);
    return c.json({ ...toApiProduct(product), source: SOURCE });
  });

  app.get("/products", async (c) => {
    const words = parseSearchQuery(c.req.query("q") ?? "");
    if (words.length === 0) {
      return fail(c, 400, "invalid_query", "Parameter q is required and must contain letters or digits.");
    }
    const limit = intParam(c.req.query("limit"), 1, MAX_LIMIT);
    const offset = intParam(c.req.query("offset"), 0, MAX_OFFSET);
    if (limit === null)
      return fail(c, 400, "invalid_limit", `limit must be an integer from 1 to ${MAX_LIMIT}.`);
    if (offset === null)
      return fail(c, 400, "invalid_offset", `offset must be an integer from 0 to ${MAX_OFFSET}.`);

    const page = await products.search(words, limit ?? DEFAULT_LIMIT, offset ?? 0);
    c.header("Cache-Control", CACHE_PRODUCT);
    return c.json({
      data: page.items.map(toApiProduct),
      limit: limit ?? DEFAULT_LIMIT,
      offset: offset ?? 0,
      has_more: page.hasMore,
      source: SOURCE,
    });
  });

  app.notFound((c) => fail(c, 404, "not_found", "Unknown route."));

  app.onError((err, c) => {
    console.error(err);
    return fail(c, 500, "internal_error", "Something went wrong.");
  });

  return app;
}
