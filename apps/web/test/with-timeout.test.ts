import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../src/util/with-timeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns the value when it arrives in time", async () => {
    expect(await withTimeout(Promise.resolve("ok"), 1000, "fallback")).toBe("ok");
  });

  it("returns the fallback when the promise fails", async () => {
    expect(await withTimeout(Promise.reject(new Error("boom")), 1000, "fallback")).toBe("fallback");
  });

  it("returns the fallback when it takes too long", async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 1000, "fallback");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe("fallback");
  });
});
