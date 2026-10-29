import { basename } from "node:path";
import { upsertProducts } from "./db/catalog.js";
import { connect, withTransaction } from "./db/connect.js";
import { findIngestionByHash, recordIngestion } from "./db/ingestions.js";
import { buildProduct } from "./domain/product.js";
import { aggregateProducts } from "./source/aggregate.js";
import { hashFile } from "./source/file-hash.js";
import { readProducts, resolveDate, type ZipNotice } from "./source/reader.js";

export interface IngestOptions {
  /** the day's ZIP of ZIPs */
  path: string;
  /** data day (YYYY-MM-DD); read from the ZIP when omitted */
  date?: string;
  /** ingest again a file that was already ingested */
  force?: boolean;
}

export type IngestOutcome =
  { status: "skipped"; previousId: number } | { status: "loaded"; inserted: number; updated: number };

const seconds = (since: number) => ((Date.now() - since) / 1000).toFixed(1);

/** Reads one day's SEPA ZIP and loads it into the catalog. Safe to repeat: a file already ingested is skipped. */
export async function ingestZip({
  path,
  date: dateArg,
  force = false,
}: IngestOptions): Promise<IngestOutcome> {
  const date = await resolveDate(path, dateArg);
  const hash = await hashFile(path);

  const db = await connect();
  try {
    const previous = await findIngestionByHash(db, hash);
    if (previous && !force) {
      console.log(
        `This file was already ingested (#${previous.id}, ${previous.createdAt.toISOString()}). Use --force to repeat it.`,
      );
      return { status: "skipped", previousId: previous.id };
    }

    const startedAt = Date.now();
    const notices: ZipNotice[] = [];
    const sources = await aggregateProducts(
      readProducts(path, (notice) => {
        notices.push(notice);
        if (notice.status !== "ok")
          console.error(`ZIP ${notice.status}: ${notice.file} ${notice.detail ?? ""}`);
      }),
    );
    console.log(`${sources.size} products read in ${seconds(startedAt)} s`);

    function* products() {
      for (const [ean, source] of sources) yield buildProduct(ean, source, date);
    }
    const { inserted, updated } = await withTransaction(db, async () => {
      const result = await upsertProducts(db, products());
      await recordIngestion(db, {
        date,
        file: basename(path),
        hash,
        zipsProcessed: notices.filter((n) => n.status === "ok").length,
        zipsFailed: notices.filter((n) => n.status === "error").length,
        productsInserted: result.inserted,
        productsUpdated: result.updated,
      });
      return result;
    });
    console.log(`Done: ${inserted} new, ${updated} updated (${seconds(startedAt)} s in total)`);
    return { status: "loaded", inserted, updated };
  } finally {
    await db.end();
  }
}
