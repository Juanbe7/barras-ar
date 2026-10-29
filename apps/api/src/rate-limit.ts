export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** epoch seconds when the window resets */
  resetAt: number;
}

export interface RateLimiter {
  hit(key: string): RateLimitResult;
}

/**
 * Fixed-window counter per key, kept in memory.
 *
 * Serverless instances do not share memory, so this is a best-effort brake per instance, not a
 * global quota. The real, shared limit belongs in the platform (a Vercel Firewall rate-limit rule).
 */
export class FixedWindowRateLimiter implements RateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): RateLimitResult {
    const now = this.now();
    this.dropExpired(now);
    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count++;
    return {
      allowed: window.count <= this.limit,
      limit: this.limit,
      remaining: Math.max(0, this.limit - window.count),
      resetAt: Math.ceil(window.resetAt / 1000),
    };
  }

  /** Keeps the map from growing without bound under many distinct clients. */
  private dropExpired(now: number): void {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
}
