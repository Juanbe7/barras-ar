import { fileURLToPath } from "node:url";
import { connect } from "../db/connect.js";
import { runMigrations } from "../db/migrations.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../../../db/migrations/", import.meta.url));

async function main() {
  const db = await connect();
  try {
    const applied = await runMigrations(db, MIGRATIONS_DIR);
    for (const name of applied) console.log("applied", name);
    console.log("migrations up to date");
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
