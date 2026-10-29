import pg from "pg";

// DATE columns as "YYYY-MM-DD" text, instead of Date objects tied to the local time zone
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

/** Pool for DATABASE_URL (Supabase Transaction pooler, which is the one meant for serverless). */
export function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new pg.Pool({
    connectionString: url,
    // the pooler's certificate is not in Node's trust chain
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10_000,
  });
}
