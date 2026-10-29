import type pg from "pg";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { from as copyFrom } from "pg-copy-streams";
import type { Product } from "../domain/product.js";
import { csvLines } from "../export/csv.js";
import { COLUMN_NAMES } from "./columns.js";

const COLUMNS = COLUMN_NAMES.join(", ");

/**
 * On conflict the product's fields are only overwritten by data from the same day or a newer one,
 * so loading an old day after a newer one never turns the catalog back.
 * first_seen and last_seen always widen.
 */
const UPDATE_FIELDS = COLUMN_NAMES.filter((column) => column !== "ean")
  .map(
    (c) =>
      `${c} = CASE WHEN EXCLUDED.data_date >= products.data_date THEN EXCLUDED.${c} ELSE products.${c} END`,
  )
  .join(",\n         ");

export interface UpsertResult {
  inserted: number;
  updated: number;
}

/** Loads the products with COPY into a staging table and merges them into `products`. Call it inside a transaction. */
export async function upsertProducts(db: pg.Client, products: Iterable<Product>): Promise<UpsertResult> {
  await db.query(`CREATE TEMP TABLE staging ON COMMIT DROP AS SELECT ${COLUMNS} FROM products WITH NO DATA`);
  const copy = db.query(copyFrom(`COPY staging (${COLUMNS}) FROM STDIN WITH (FORMAT csv, NULL '')`));
  await pipeline(Readable.from(csvLines(products)), copy);

  const { rows } = await db.query(
    `WITH merged AS (
       INSERT INTO products (${COLUMNS}, first_seen, last_seen)
       SELECT ${COLUMNS}, data_date, data_date FROM staging
       ON CONFLICT (ean) DO UPDATE SET
         ${UPDATE_FIELDS},
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
