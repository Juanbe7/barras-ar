export interface ReadConfirmer {
  /** Registers a read and returns true once the same code has been read `required` times in a row. */
  confirm(code: string): boolean;
}

/**
 * A scanner can misread a few digits and still produce a code with a valid check digit (about one in ten
 * misreads). Random errors rarely repeat, so a code is trusted only when the camera reads it several
 * times in a row, each read no later than `maxGapMs` after the previous one.
 */
export function createReadConfirmer(
  required: number,
  maxGapMs: number,
  now: () => number = Date.now,
): ReadConfirmer {
  let candidate = "";
  let count = 0;
  let lastReadAt = 0;

  return {
    confirm(code) {
      const at = now();
      if (code === candidate && at - lastReadAt <= maxGapMs) count++;
      else {
        candidate = code;
        count = 1;
      }
      lastReadAt = at;
      return count >= required;
    },
  };
}
