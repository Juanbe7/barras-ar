import type { Channel } from "../domain/channel";

export interface RecentProduct {
  ean: string;
  description: string;
  /** The typical price in each channel, so the list can show the one the person is looking at. */
  prices: Record<Channel, number | null>;
}

export interface RecentProducts {
  list(): RecentProduct[];
  add(product: RecentProduct): void;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "barras-ar:recent";
const MAX_RECENT = 5;

const isPrice = (value: unknown): value is number | null => value === null || typeof value === "number";

/** Reads an entry as stored now, or as stored before there were two prices (a single `price`: supermarket). */
function toRecentProduct(value: unknown): RecentProduct | null {
  if (typeof value !== "object" || value === null) return null;
  const { ean, description, prices, price } = value as Record<string, unknown>;
  if (typeof ean !== "string" || typeof description !== "string") return null;

  if (typeof prices === "object" && prices !== null) {
    const { retail, wholesale } = prices as Record<string, unknown>;
    return isPrice(retail) && isPrice(wholesale) ? { ean, description, prices: { retail, wholesale } } : null;
  }
  return isPrice(price) ? { ean, description, prices: { retail: price, wholesale: null } } : null;
}

/** The last products the person looked at, kept on the phone. Storage can be blocked, so it never throws. */
export function createRecentProducts(storage: KeyValueStorage): RecentProducts {
  function list(): RecentProduct[] {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map(toRecentProduct).filter((product) => product !== null);
    } catch {
      return [];
    }
  }

  function add(product: RecentProduct): void {
    const next = [product, ...list().filter((p) => p.ean !== product.ean)].slice(0, MAX_RECENT);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // private mode or full storage: the history is a convenience, so losing it is fine
    }
  }

  return { list, add };
}
