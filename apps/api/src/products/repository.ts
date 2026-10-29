import type pg from "pg";

/** National list price of one channel, per unit with VAT, promotions excluded. */
export interface PriceRecord {
  median: number;
  min: number;
  max: number;
  /** day of the SEPA file the price comes from */
  dataDate: string;
}

/** A catalog record: the `products` row with its prices from the `reference_prices` table. */
export interface ProductRecord {
  ean: string;
  description: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  /** supermarkets */
  retail: PriceRecord | null;
  /** wholesalers: an approximate cost for a shop that buys to resell */
  wholesale: PriceRecord | null;
  chains: number;
  dataDate: string;
  firstSeen: string;
  lastSeen: string;
}

export interface SearchPage {
  items: ProductRecord[];
  hasMore: boolean;
}

/** A product found through the code of a box (DUN-14) that holds `units` of it. */
export interface BoxMatch {
  product: ProductRecord;
  units: number;
}

export interface CatalogStats {
  products: number;
  /** most recent day of SEPA data in the catalog */
  latestDataDate: string | null;
}

/** What the API needs from the catalog; the routes depend on this, not on PostgreSQL. */
export interface ProductRepository {
  findByEan(ean: string): Promise<ProductRecord | null>;
  /** The product that a wholesale box code (DUN-14, 14 digits) belongs to. */
  findByBoxCode(dun14: string): Promise<BoxMatch | null>;
  /** Products whose search text contains every one of `words` (partial matches count). */
  search(words: string[], limit: number, offset: number): Promise<SearchPage>;
  /**
   * Products whose codes are close to `ean` (a 13-digit code that need not exist in the catalog):
   * same manufacturer and, often, same product line. Never includes `ean` itself.
   */
  findRelated(ean: string, limit: number): Promise<ProductRecord[]>;
  stats(): Promise<CatalogStats>;
  /** Throws if the database is not reachable. */
  ping(): Promise<void>;
}

// The leading digits of a code identify its manufacturer and the next ones its product line.
// Measured on the catalog, neighbours sharing 11 digits have the same brand 80% of the time, 63% at 10,
// 49% at 9 and under 40% at 8 or fewer (where different companies get mixed), so 9 is the floor.
const RELATED_MIN_PREFIX = 9;

/** A product with both of its prices; `extra` adds columns and joins for the queries that need them. */
const selectProducts = (extra = { columns: "", join: "" }) => `
  SELECT p.ean, p.description, p.brand, p.quantity, p.unit, p.category, p.chains, p.data_date, p.first_seen, p.last_seen,
         r.price_median AS retail_median, r.price_min AS retail_min, r.price_max AS retail_max, r.data_date AS retail_date,
         w.price_median AS wholesale_median, w.price_min AS wholesale_min, w.price_max AS wholesale_max, w.data_date AS wholesale_date
         ${extra.columns}
  FROM products p
  ${extra.join}
  LEFT JOIN reference_prices r ON r.ean = p.ean AND r.channel = 'retail'
  LEFT JOIN reference_prices w ON w.ean = p.ean AND w.channel = 'wholesale'`;

type Row = Record<string, string | number | null>;

// numeric columns arrive as strings; null stays null
const toNumber = (value: string | number | null) => (value === null ? null : Number(value));

function toPrice(row: Row, channel: "retail" | "wholesale"): PriceRecord | null {
  const median = toNumber(row[`${channel}_median`] ?? null);
  const min = toNumber(row[`${channel}_min`] ?? null);
  const max = toNumber(row[`${channel}_max`] ?? null);
  if (median === null || min === null || max === null) return null;
  return { median, min, max, dataDate: row[`${channel}_date`] as string };
}

function toRecord(row: Row): ProductRecord {
  return {
    ean: row.ean as string,
    description: row.description as string,
    brand: row.brand as string | null,
    quantity: toNumber(row.quantity ?? null),
    unit: row.unit as string | null,
    category: row.category as string | null,
    retail: toPrice(row, "retail"),
    wholesale: toPrice(row, "wholesale"),
    chains: row.chains as number,
    dataDate: row.data_date as string,
    firstSeen: row.first_seen as string,
    lastSeen: row.last_seen as string,
  };
}

export class PgProductRepository implements ProductRepository {
  /** `getPool` is called on every query, so the pool can be created on first use. */
  constructor(private readonly getPool: () => pg.Pool) {}

  async findByEan(ean: string): Promise<ProductRecord | null> {
    const { rows } = await this.getPool().query(`${selectProducts()} WHERE p.ean = $1`, [ean]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async findByBoxCode(dun14: string): Promise<BoxMatch | null> {
    const { rows } = await this.getPool().query(
      `${selectProducts({ columns: ", b.units AS box_units", join: "JOIN bulk_units b ON b.ean = p.ean" })}
       WHERE b.dun14 = $1`,
      [dun14],
    );
    return rows[0] ? { product: toRecord(rows[0]), units: Number(rows[0].box_units) } : null;
  }

  async search(words: string[], limit: number, offset: number): Promise<SearchPage> {
    const patterns = words.map((word) => `%${word}%`);
    // one extra row tells whether there is a next page without counting the whole result
    const { rows } = await this.getPool().query(
      `${selectProducts()}
       WHERE p.search_text LIKE ALL ($1::text[])
       ORDER BY p.chains DESC, p.ean
       LIMIT $2 OFFSET $3`,
      [patterns, limit + 1, offset],
    );
    return { items: rows.slice(0, limit).map(toRecord), hasMore: rows.length > limit };
  }

  async findRelated(ean: string, limit: number): Promise<ProductRecord[]> {
    // EAN-8 and short in-store codes are zero-padded to 13 digits; their leading digits are zeros, not a
    // manufacturer, so every one of them would "share a prefix" with unrelated products.
    if (ean.startsWith("0000")) return [];
    const prefix = ean.slice(0, RELATED_MIN_PREFIX);
    // closest first: the longer the shared prefix, then the nearer the item number, then the more widespread
    const { rows } = await this.getPool().query(
      `${selectProducts()}
       WHERE p.ean BETWEEN $1 AND $2 AND p.ean <> $3
       ORDER BY CASE WHEN left(p.ean, 11) = $4 THEN 2 WHEN left(p.ean, 10) = $5 THEN 1 ELSE 0 END DESC,
                abs(left(p.ean, 12)::bigint - $6::bigint),
                p.chains DESC, p.ean
       LIMIT $7`,
      [prefix + "0000", prefix + "9999", ean, ean.slice(0, 11), ean.slice(0, 10), ean.slice(0, 12), limit],
    );
    return rows.map(toRecord);
  }

  async stats(): Promise<CatalogStats> {
    const { rows } = await this.getPool().query(
      "SELECT count(*)::int AS products, max(data_date) AS latest_data_date FROM products",
    );
    return { products: rows[0].products, latestDataDate: rows[0].latest_data_date };
  }

  async ping(): Promise<void> {
    await this.getPool().query("SELECT 1");
  }
}
