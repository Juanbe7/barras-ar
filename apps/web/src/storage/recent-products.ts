export interface RecentProduct {
  ean: string;
  description: string;
  price: number | null;
}

export interface RecentProducts {
  list(): RecentProduct[];
  add(product: RecentProduct): void;
}

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "barras-ar:recent";
const MAX_RECENT = 5;

function isRecentProduct(value: unknown): value is RecentProduct {
  if (typeof value !== "object" || value === null) return false;
  const { ean, description, price } = value as Record<string, unknown>;
  return (
    typeof ean === "string" &&
    typeof description === "string" &&
    (price === null || typeof price === "number")
  );
}

/** The last products the person looked at, kept on the phone. Storage can be blocked, so it never throws. */
export function createRecentProducts(storage: KeyValueStorage): RecentProducts {
  function list(): RecentProduct[] {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isRecentProduct) : [];
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
