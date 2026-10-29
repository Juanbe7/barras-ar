const BARCODE_PATTERN = /^\d{8,14}$/;

/** Whether the text is shaped like a barcode (8 to 14 digits), which the API accepts. */
export function looksLikeBarcode(text: string): boolean {
  return BARCODE_PATTERN.test(text);
}

/** GS1 check digit: weights 3,1,3,1... from the digit next to the check digit, going left. */
export function hasValidCheckDigit(code: string): boolean {
  if (!looksLikeBarcode(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
