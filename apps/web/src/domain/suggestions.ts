import { looksLikeBarcode } from "./barcode";

export const MIN_SUGGEST_LENGTH = 2;

/** Suggestions help while writing a name; a barcode or one letter is not worth a request. */
export function shouldSuggest(text: string): boolean {
  const query = text.trim();
  return query.length >= MIN_SUGGEST_LENGTH && !looksLikeBarcode(query);
}
