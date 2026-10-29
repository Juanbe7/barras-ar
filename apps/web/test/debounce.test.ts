import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce } from "../src/util/debounce";

describe("debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once, with the last arguments, after the calls stop", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("g");
    vi.advanceTimersByTime(200);
    debounced("ga");
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("ga");
  });

  it("does nothing after being cancelled", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced("ga");
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
