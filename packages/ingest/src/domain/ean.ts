/** GTIN check digit (covers EAN-8, UPC-A and EAN-13, with or without leading zeros). */
export function isValidEan(code: string): boolean {
  if (!/^\d{2,}$/.test(code)) return false;
  const body = code.slice(0, -1);
  const checkDigit = Number(code.slice(-1));
  let total = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    total += digit * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (total % 10)) % 10 === checkDigit;
}

/**
 * Whether `dun14` is the code of a box of the product `ean` (13 digits): a GTIN-14 with a valid check
 * digit that is not just the unit's own code with a leading zero.
 */
export function isBoxCode(dun14: string, ean: string): boolean {
  return /^\d{14}$/.test(dun14) && isValidEan(dun14) && dun14 !== `0${ean}`;
}

/** Pads a code to 13 digits (GTIN-13) with leading zeros. */
export function normalizeEan(code: string): string {
  return code.replace(/^0+/, "").padStart(13, "0");
}
