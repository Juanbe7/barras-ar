import { createApp } from "./app.js";
import { createPool } from "./db.js";
import { PgProductRepository } from "./products/repository.js";
import { FixedWindowRateLimiter } from "./rate-limit.js";

const REQUESTS_PER_MINUTE = 60;

/** The production app: PostgreSQL catalog and an in-memory limiter. Vercel serves the default export. */
export default createApp({
  products: new PgProductRepository(createPool()),
  rateLimiter: new FixedWindowRateLimiter(REQUESTS_PER_MINUTE, 60_000),
});
