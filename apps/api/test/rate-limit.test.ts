import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter } from "../src/rate-limit.js";

describe("FixedWindowRateLimiter", () => {
  it("allows up to the limit and then blocks", () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000, () => 0);
    expect(limiter.hit("a")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.hit("a")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.hit("a")).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("starts a new window once the previous one ends", () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(1, 60_000, () => now);
    limiter.hit("a");
    expect(limiter.hit("a").allowed).toBe(false);
    now = 60_000;
    expect(limiter.hit("a").allowed).toBe(true);
  });

  it("keeps clients apart and reports when the window resets", () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000, () => 5_000);
    limiter.hit("a");
    expect(limiter.hit("b").allowed).toBe(true);
    expect(limiter.hit("a").resetAt).toBe(65);
  });
});
