/** Suffix some chains append to the description, e.g. "BSA-80-gr." */
const CHAIN_SUFFIX = /\s+[A-Z]{3}-[\d.]+-[a-zA-Z]+\.?(\s+[A-Z]{3}-[\d.]+-[a-zA-Z]+\.?)*\s*$/;

export function cleanDescription(description: string): string {
  return description
    .replace(CHAIN_SUFFIX, "")
    .replace(/\s+/g, " ")
    .replace(/^[ .,]+|[ .,]+$/g, "");
}

function stripAccents(s: string): string {
  return s.normalize("NFKD").replace(/[^\p{ASCII}]/gu, "");
}

export function toAsciiUpper(s: string): string {
  return stripAccents(s).toUpperCase();
}

/** Lowercase, accent-free words used to build the search text. */
export function searchWords(s: string): string[] {
  return (
    stripAccents(s)
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  );
}

/** A number as chains report it ("00400", "0.4", "400.00", "2500,5"); null if it is not one. */
export function parseNumber(s: string): number | null {
  const t = s.trim().replace(",", ".");
  return /^(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
