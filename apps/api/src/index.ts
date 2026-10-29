import { Hono } from "hono";
import type pg from "pg";
import { createApp } from "./create-app.js";
import { createPool } from "./db.js";
import { PgProductRepository } from "./products/repository.js";
import { FixedWindowRateLimiter } from "./rate-limit.js";

const REQUESTS_PER_MINUTE = 60;

// Created on first use, not on import: a missing DATABASE_URL then fails the requests that need
// the database (as a JSON 500 in the logs) instead of crashing the whole function at startup.
let pool: pg.Pool | undefined;
const getPool = () => (pool ??= createPool());

/**
 * The production app: PostgreSQL catalog and an in-memory limiter. Vercel serves the default export.
 * Its build only accepts an entry point that imports Hono itself, which is why the instance is made here.
 */
export default createApp(
  {
    products: new PgProductRepository(getPool),
    rateLimiter: new FixedWindowRateLimiter(REQUESTS_PER_MINUTE, 60_000),
  },
  new Hono(),
);
