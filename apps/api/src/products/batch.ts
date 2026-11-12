import { lookupEan } from "./lookup.js";
import { toApiProduct, type ApiProduct } from "./presenter.js";
import type { ProductRepository } from "./repository.js";
import { parseSearchQuery } from "./search-query.js";

/**
 * `POST /products/batch`: many lookups (by text or by barcode) in one request, so a client that
 * must look up hundreds of products (a bulk import) spends one slot of the rate limit instead of
 * one per product.
 */

export const MAX_BATCH_ITEMS = 100;
export const MAX_ID_LENGTH = 64;
export const MAX_QUERY_LENGTH = 200;
export const MAX_ITEM_LIMIT = 20;
export const DEFAULT_ITEM_LIMIT = 5;
/** Queries running at once: keeps a 100-item batch from exhausting the database pool. */
export const BATCH_CONCURRENCY = 8;

export interface BatchItem {
  id: string;
  q?: string;
  ean?: string;
  limit: number;
}

export interface BatchItemError {
  code: string;
  message: string;
}

/** One entry per requested item, in the same order. A bad item never fails the whole batch. */
export interface BatchItemResult {
  id: string;
  found: boolean;
  data: Array<ApiProduct & { pack?: { code: string; units: number } }>;
  error?: BatchItemError;
}

/** An item that passed the checks of the whole request but is itself invalid. */
type ParsedItem = { kind: "ok"; item: BatchItem } | { kind: "error"; id: string; error: BatchItemError };

export type ParsedBatch =
  { kind: "ok"; items: ParsedItem[] } | { kind: "error"; code: string; message: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Checks the request. Problems with the request as a whole (not JSON-shaped, empty, too big,
 * missing or repeated ids) reject it; problems with a single item are reported on that item.
 */
export function parseBatchBody(body: unknown): ParsedBatch {
  if (!isRecord(body) || !Array.isArray(body.items)) {
    return {
      kind: "error",
      code: "invalid_body",
      message: 'The body must be a JSON object with an "items" array.',
    };
  }
  if (body.items.length === 0) {
    return { kind: "error", code: "invalid_items", message: "items must not be empty." };
  }
  if (body.items.length > MAX_BATCH_ITEMS) {
    return {
      kind: "error",
      code: "batch_too_large",
      message: `A batch can have at most ${MAX_BATCH_ITEMS} items.`,
    };
  }

  const seen = new Set<string>();
  const items: ParsedItem[] = [];

  for (const raw of body.items) {
    const id = isRecord(raw) ? raw.id : undefined;
    if (typeof id !== "string" || id.length === 0 || id.length > MAX_ID_LENGTH) {
      return {
        kind: "error",
        code: "invalid_id",
        message: `Every item needs a string id of 1 to ${MAX_ID_LENGTH} characters.`,
      };
    }
    if (seen.has(id)) {
      return {
        kind: "error",
        code: "duplicate_id",
        message: `The id "${id}" is used by more than one item.`,
      };
    }
    seen.add(id);
    items.push(parseItem(id, raw as Record<string, unknown>));
  }

  return { kind: "ok", items };
}

function parseItem(id: string, raw: Record<string, unknown>): ParsedItem {
  const bad = (code: string, message: string): ParsedItem => ({
    kind: "error",
    id,
    error: { code, message },
  });

  const hasQ = raw.q !== undefined;
  const hasEan = raw.ean !== undefined;
  if (hasQ === hasEan) return bad("invalid_item", "Send exactly one of q or ean.");

  let limit = DEFAULT_ITEM_LIMIT;
  if (raw.limit !== undefined) {
    if (
      typeof raw.limit !== "number" ||
      !Number.isInteger(raw.limit) ||
      raw.limit < 1 ||
      raw.limit > MAX_ITEM_LIMIT
    ) {
      return bad("invalid_limit", `limit must be an integer from 1 to ${MAX_ITEM_LIMIT}.`);
    }
    limit = raw.limit;
  }

  if (hasEan) {
    if (typeof raw.ean !== "string" || !/^\d{8,14}$/.test(raw.ean)) {
      return bad("invalid_ean", "The barcode must have 8 to 14 digits.");
    }
    return { kind: "ok", item: { id, ean: raw.ean, limit } };
  }

  if (typeof raw.q !== "string" || raw.q.length > MAX_QUERY_LENGTH || parseSearchQuery(raw.q).length === 0) {
    return bad(
      "invalid_query",
      `q must contain letters or digits and be at most ${MAX_QUERY_LENGTH} characters.`,
    );
  }
  return { kind: "ok", item: { id, q: raw.q, limit } };
}

async function runItem(products: ProductRepository, item: BatchItem): Promise<BatchItemResult> {
  try {
    if (item.ean !== undefined) {
      const lookup = await lookupEan(products, item.ean);
      if (lookup.kind !== "found") return { id: item.id, found: false, data: [] };
      return {
        id: item.id,
        found: true,
        data: [{ ...toApiProduct(lookup.record), ...(lookup.pack ? { pack: lookup.pack } : {}) }],
      };
    }

    const page = await products.search(parseSearchQuery(item.q ?? ""), item.limit, 0);
    return { id: item.id, found: page.items.length > 0, data: page.items.map(toApiProduct) };
  } catch (err) {
    // The details stay in the logs: the response never leaks what the database said.
    console.error(err);
    return {
      id: item.id,
      found: false,
      data: [],
      error: { code: "internal_error", message: "This item could not be looked up." },
    };
  }
}

/** Answers every item, at most BATCH_CONCURRENCY at a time, keeping the request's order. */
export async function runBatch(
  products: ProductRepository,
  parsed: ParsedItem[],
): Promise<BatchItemResult[]> {
  const results: BatchItemResult[] = new Array(parsed.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < parsed.length) {
      const index = next++;
      const entry = parsed[index]!;
      results[index] =
        entry.kind === "ok"
          ? await runItem(products, entry.item)
          : { id: entry.id, found: false, data: [], error: entry.error };
    }
  }

  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, parsed.length) }, worker));
  return results;
}
