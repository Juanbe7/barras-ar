export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  /** Drops the call that is waiting, if any. */
  cancel(): void;
}

/** Runs `fn` once the calls stop for `waitMs`, with the arguments of the last call. */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => unknown,
  waitMs: number,
): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: Args) => {
    clearTimeout(timer);
    timer = setTimeout(() => void fn(...args), waitMs);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
