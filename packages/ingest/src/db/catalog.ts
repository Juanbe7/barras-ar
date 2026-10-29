import type pg from "pg";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { from as copyFrom } from "pg-copy-streams";
import type { Product } from "../domain/product.js";
import { csvLines, csvRow } from "../export/csv.js";
import { COLUMN_NAMES } from "./columns.js";

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/** COPYs `lines` (CSV, empty cell = NULL) into a new temporary table shaped like `table`'s `columns`. */
async function stage(
  db: pg.Client,
  table: string,
  columns: string[],
  lines: Iterable<string>,
): Promise<string> {
  const staging = `staging_${table}`;
  const list = columns.join(", ");
  await db.query(`CREATE TEMP TABLE ${staging} ON COMMIT DROP AS SELECT ${list} FROM ${table} WITH NO DATA`);
  const copy = db.query(copyFrom(`COPY ${staging} (${list}) FROM STDIN WITH (FORMAT csv, NULL '')`));
  await pipeline(Readable.from(lines), copy);
  return staging;
}

/**
 * Where a row already exists, its fields are only overwritten by data from the same day or a newer one,
 * so loading an old day after a newer one never turns the catalog back.
 */
const keepNewest = (table: string, columns: string[]) =>
  columns
    .map(
      (c) =>
        `${c} = CASE WHEN EXCLUDED.data_date >= ${table}.data_date THEN EXCLUDED.${c} ELSE ${table}.${c} END`,
    )
    .join(",\n         ");

/** Loads the products into `products`. first_seen and last_seen always widen. Call it inside a transaction. */
export async function upsertProducts(db: pg.Client, products: Iterable<Product>): Promise<UpsertResult> {
  const staging = await stage(db, "products", COLUMN_NAMES, csvLines(products));
  const columns = COLUMN_NAMES.join(", ");
  const { rows } = await db.query(
    `WITH merged AS (
       INSERT INTO products (${columns}, first_seen, last_seen)
       SELECT ${columns}, data_date, data_date FROM ${staging}
       ON CONFLICT (ean) DO UPDATE SET
         ${keepNewest(
           "products",
           COLUMN_NAMES.filter((c) => c !== "ean"),
         )},
         first_seen = LEAST(products.first_seen, EXCLUDED.first_seen),
         last_seen  = GREATEST(products.last_seen, EXCLUDED.last_seen)
       RETURNING (xmax = 0) AS inserted
     )
     SELECT count(*) FILTER (WHERE inserted)::int AS inserted,
            count(*) FILTER (WHERE NOT inserted)::int AS updated
     FROM merged`,
  );
  return rows[0] as UpsertResult;
}

const PRICE_COLUMNS = ["ean", "channel", "price_median", "price_min", "price_max", "chains", "data_date"];

/** Loads the retail and wholesale reference prices. The products must already be in the table. */
export async function upsertReferencePrices(db: pg.Client, products: Iterable<Product>): Promise<number> {
  function* lines() {
    for (const { ean, prices } of products) {
      for (const p of prices) yield csvRow([ean, p.channel, p.median, p.min, p.max, p.chains, p.dataDate]);
    }
  }
  const staging = await stage(db, "reference_prices", PRICE_COLUMNS, lines());
  const columns = PRICE_COLUMNS.join(", ");
  const { rowCount } = await db.query(
    `INSERT INTO reference_prices (${columns}) SELECT ${columns} FROM ${staging}
     ON CONFLICT (ean, channel) DO UPDATE SET
       ${keepNewest(
         "reference_prices",
         PRICE_COLUMNS.filter((c) => c !== "ean" && c !== "channel"),
       )}`,
  );
  return rowCount ?? 0;
}

/** Loads the wholesale boxes (DUN-14). A box code is declared by one product, so a new declaration replaces the old. */
export async function upsertBulkUnits(db: pg.Client, products: Iterable<Product>): Promise<number> {
  function* lines() {
    for (const { ean, bulkUnits } of products) {
      for (const box of bulkUnits) yield csvRow([box.dun14, ean, box.units]);
    }
  }
  const staging = await stage(db, "bulk_units", ["dun14", "ean", "units"], lines());
  const { rowCount } = await db.query(
    `INSERT INTO bulk_units (dun14, ean, units) SELECT dun14, ean, units FROM ${staging}
     ON CONFLICT (dun14) DO UPDATE SET ean = EXCLUDED.ean, units = EXCLUDED.units`,
  );
  return rowCount ?? 0;
}
