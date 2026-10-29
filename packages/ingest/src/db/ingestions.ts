import type pg from "pg";

export interface IngestionRecord {
  date: string;
  file: string;
  hash: string;
  zipsProcessed: number;
  zipsFailed: number;
  productsInserted: number;
  productsUpdated: number;
}

/** The earlier ingestion of a file with this content, if any. */
export async function findIngestionByHash(
  db: pg.Client,
  hash: string,
): Promise<{ id: number; createdAt: Date } | null> {
  const { rows } = await db.query("SELECT id, created_at FROM ingestions WHERE hash = $1", [hash]);
  return rows[0] ? { id: rows[0].id, createdAt: rows[0].created_at } : null;
}

/** Logs an ingestion; repeating a file (--force) refreshes its row. */
export async function recordIngestion(db: pg.Client, r: IngestionRecord): Promise<void> {
  await db.query(
    `INSERT INTO ingestions (data_date, file, hash, zips_processed, zips_failed, products_inserted, products_updated)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (hash) DO UPDATE SET
       created_at = now(),
       zips_processed = EXCLUDED.zips_processed,
       zips_failed = EXCLUDED.zips_failed,
       products_inserted = EXCLUDED.products_inserted,
       products_updated = EXCLUDED.products_updated`,
    [r.date, r.file, r.hash, r.zipsProcessed, r.zipsFailed, r.productsInserted, r.productsUpdated],
  );
}
