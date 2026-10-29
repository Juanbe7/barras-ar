import { ingestZip } from "../ingest-zip.js";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const wholesale = args.find((arg) => arg.startsWith("--wholesale="))?.slice("--wholesale=".length);
  const [retail, date] = args.filter((arg) => !arg.startsWith("--"));
  if (!retail) {
    console.error(
      "Usage: npm run load -- ../../in/sepa_jueves.zip [YYYY-MM-DD] [--wholesale=path/to/mayorista.zip] [--force]",
    );
    process.exit(1);
  }
  await ingestZip({ retail, wholesale, date, force });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
