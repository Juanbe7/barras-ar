import type pg from "pg";

/** A catalog record as stored in the `products` table. */
export interface ProductRecord {
  ean: string;
  description: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  priceMedian: number | null;
  priceMin: number | null;
  priceMax: number | null;
  chains: number;
  dataDate: string;
  firstSeen: string;
  lastSeen: string;
}

export interface SearchPage {
  items: ProductRecord[];
  hasMore: boolean;
}

export interface CatalogStats {
  products: number;
  /** most recent day of SEPA data in the catalog */
  latestDataDate: string | null;
}

/** What the API needs from the catalog; the routes depend on this, not on PostgreSQL. */
export interface ProductRepository {
  findByEan(ean: string): Promise<ProductRecord | null>;
  /** Products whose search text contains every one of `words` (partial matches count). */
  search(words: string[], limit: number, offset: number): Promise<SearchPage>;
  stats(): Promise<CatalogStats>;
  /** Throws if the database is not reachable. */
  ping(): Promise<void>;
}

const COLUMNS = `ean, description, brand, quantity, unit, category, price_median, price_min, price_max,
                 chains, data_date, first_seen, last_seen`;

// numeric columns arrive as strings; null stays null
const toNumber = (value: string | null) => (value === null ? null : Number(value));

function toRecord(row: Record<string, string | number | null>): ProductRecord {
  return {
    ean: row.ean as string,
    description: row.description as string,
    brand: row.brand as string | null,
    quantity: toNumber(row.quantity as string | null),
    unit: row.unit as string | null,
    category: row.category as string | null,
    priceMedian: toNumber(row.price_median as string | null),
    priceMin: toNumber(row.price_min as string | null),
    priceMax: toNumber(row.price_max as string | null),
    chains: row.chains as number,
    dataDate: row.data_date as string,
    firstSeen: row.first_seen as string,
    lastSeen: row.last_seen as string,
  };
}

export class PgProductRepository implements ProductRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findByEan(ean: string): Promise<ProductRecord | null> {
    const { rows } = await this.pool.query(`SELECT ${COLUMNS} FROM products WHERE ean = $1`, [ean]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async search(words: string[], limit: number, offset: number): Promise<SearchPage> {
    const patterns = words.map((word) => `%${word}%`);
    // one extra row tells whether there is a next page without counting the whole result
    const { rows } = await this.pool.query(
      `SELECT ${COLUMNS} FROM products
       WHERE search_text LIKE ALL ($1::text[])
       ORDER BY chains DESC, ean
       LIMIT $2 OFFSET $3`,
      [patterns, limit + 1, offset],
    );
    return { items: rows.slice(0, limit).map(toRecord), hasMore: rows.length > limit };
  }

  async stats(): Promise<CatalogStats> {
    const { rows } = await this.pool.query(
      "SELECT count(*)::int AS products, max(data_date) AS latest_data_date FROM products",
    );
    return { products: rows[0].products, latestDataDate: rows[0].latest_data_date };
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }
}
