import type pg from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withTransaction } from "./connect.js";

/** Applies the .sql files of `directory` that were not applied yet, in name order. Returns the ones applied. */
export async function runMigrations(db: pg.Client, directory: string): Promise<string[]> {
  await db.query(
    "CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  const done = new Set((await db.query("SELECT name FROM migrations")).rows.map((row) => row.name as string));
  const pending = readdirSync(directory)
    .filter((file) => file.endsWith(".sql") && !done.has(file))
    .sort();

  for (const name of pending) {
    await withTransaction(db, async () => {
      await db.query(readFileSync(join(directory, name), "utf8"));
      await db.query("INSERT INTO migrations (name) VALUES ($1)", [name]);
    });
  }
  return pending;
}
