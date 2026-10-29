import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { ingestZip } from "../ingest-zip.js";
import { fetchLatestDailyResource, isStale } from "../source/ckan.js";
import { downloadFile } from "../source/download.js";

const DEFAULT_MAX_AGE_DAYS = 3;

/** What the scheduled workflow runs: find the latest SEPA day, download it and load it. */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const maxAgeArg = args.find((arg) => arg.startsWith("--max-age-days="));
  const maxAgeDays = maxAgeArg ? Number(maxAgeArg.split("=")[1]) : DEFAULT_MAX_AGE_DAYS;

  const resource = await fetchLatestDailyResource();
  console.log(`Latest SEPA file: ${resource.name} (published ${resource.lastModified.toISOString()})`);

  // a loud failure is the alert that the source stopped publishing
  if (isStale(resource, new Date(), maxAgeDays)) {
    throw new Error(
      `The newest SEPA file is more than ${maxAgeDays} days old: the source may have stopped publishing`,
    );
  }

  const folder = mkdtempSync(join(tmpdir(), "sepa-"));
  try {
    // keep the portal's file name (sepa_jueves.zip): it is what the ingestion log records
    const zip = join(folder, basename(new URL(resource.url).pathname));
    await downloadFile(resource.url, zip);
    console.log(`Downloaded ${(statSync(zip).size / 1e6).toFixed(0)} MB`);
    await ingestZip({ path: zip, force });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
