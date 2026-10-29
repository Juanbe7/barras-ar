import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { ingestZip } from "../ingest-zip.js";
import {
  fetchLatestDailyResource,
  isStale,
  SEPA_RETAIL_PACKAGE_URL,
  SEPA_WHOLESALE_PACKAGE_URL,
  type DailyResource,
} from "../source/ckan.js";
import { downloadFile } from "../source/download.js";

const DEFAULT_MAX_AGE_DAYS = 3;

async function download(resource: DailyResource, folder: string): Promise<string> {
  // keep the portal's file name (sepa_jueves.zip): it is what the ingestion log records
  const path = join(folder, basename(new URL(resource.url).pathname));
  await downloadFile(resource.url, path);
  console.log(`Downloaded ${basename(path)}: ${(statSync(path).size / 1e6).toFixed(0)} MB`);
  return path;
}

/**
 * The wholesale file is a complement: if the portal lacks it, it is stale or it fails to download, the run
 * goes on with retail alone and says so, instead of losing the whole day.
 */
async function latestWholesale(folder: string, maxAgeDays: number): Promise<string | undefined> {
  try {
    const resource = await fetchLatestDailyResource(SEPA_WHOLESALE_PACKAGE_URL);
    console.log(`Latest wholesale file: ${resource.name} (published ${resource.lastModified.toISOString()})`);
    if (isStale(resource, new Date(), maxAgeDays)) {
      console.error(`WARNING: the wholesale file is more than ${maxAgeDays} days old; loading retail only`);
      return undefined;
    }
    return await download(resource, join(folder, "wholesale"));
  } catch (err) {
    console.error(`WARNING: wholesale unavailable (${(err as Error).message}); loading retail only`);
    return undefined;
  }
}

/** What the scheduled workflow runs: find the latest SEPA day, download it and load it. */
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const maxAgeArg = args.find((arg) => arg.startsWith("--max-age-days="));
  const maxAgeDays = maxAgeArg ? Number(maxAgeArg.split("=")[1]) : DEFAULT_MAX_AGE_DAYS;

  const retail = await fetchLatestDailyResource(SEPA_RETAIL_PACKAGE_URL);
  console.log(`Latest retail file: ${retail.name} (published ${retail.lastModified.toISOString()})`);

  // a loud failure is the alert that the source stopped publishing
  if (isStale(retail, new Date(), maxAgeDays)) {
    throw new Error(
      `The newest SEPA file is more than ${maxAgeDays} days old: the source may have stopped publishing`,
    );
  }

  const folder = mkdtempSync(join(tmpdir(), "sepa-"));
  try {
    const retailPath = await download(retail, join(folder, "retail"));
    const wholesalePath = await latestWholesale(folder, maxAgeDays);
    await ingestZip({ retail: retailPath, wholesale: wholesalePath, force });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
