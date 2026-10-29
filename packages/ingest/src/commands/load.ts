import { ingestZip } from "../ingest-zip.js";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const [path, date] = args.filter((arg) => !arg.startsWith("--"));
  if (!path) {
    console.error("Usage: npm run load -- ../../in/sepa_jueves.zip [YYYY-MM-DD] [--force]");
    process.exit(1);
  }
  await ingestZip({ path, date, force });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
