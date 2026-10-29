import pg from "pg";

// return DATE columns as "YYYY-MM-DD" text instead of Date objects tied to the local time zone
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/** Connects to DATABASE_URL (Supabase Session pooler, which requires TLS). */
export async function connect(): Promise<pg.Client> {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("[YOUR-PASSWORD]")) {
    throw new Error("DATABASE_URL is missing: set it in packages/ingest/.env with the real password");
  }
  // the pooler's certificate is not in Node's trust chain
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

/** Runs `work` in a transaction: commit if it resolves, rollback if it throws. */
export async function withTransaction<T>(db: pg.Client, work: () => Promise<T>): Promise<T> {
  await db.query("BEGIN");
  try {
    const result = await work();
    await db.query("COMMIT");
    return result;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
