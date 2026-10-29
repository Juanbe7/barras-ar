const MAX_WORDS = 8;
const MAX_WORD_LENGTH = 40;

/**
 * Splits a user's search into the words matched against `products.search_text`.
 * It must normalize the same way the ingestion builds that column (lowercase, no accents,
 * only [a-z0-9]); see `searchWords` in packages/ingest/src/domain/text.ts.
 */
export function parseSearchQuery(q: string): string[] {
  const words = q
    .normalize("NFKD")
    .replace(/[^\p{ASCII}]/gu, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  return (words ?? []).slice(0, MAX_WORDS).map((word) => word.slice(0, MAX_WORD_LENGTH));
}
