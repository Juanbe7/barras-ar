import { createHash } from "node:crypto";
import { basename } from "node:path";
import { upsertBulkUnits, upsertProducts, upsertReferencePrices } from "./db/catalog.js";
import { connect, withTransaction } from "./db/connect.js";
import { findIngestionByHash, recordIngestion } from "./db/ingestions.js";
import { buildProduct, type Channel } from "./domain/product.js";
import { aggregateProducts } from "./source/aggregate.js";
import { hashFile } from "./source/file-hash.js";
import { readProducts, resolveDate, type ProductRow, type ZipNotice } from "./source/reader.js";

export interface IngestOptions {
  /** the retail day's ZIP of ZIPs */
  retail: string;
  /** the wholesale day's ZIP of ZIPs; the run works without it */
  wholesale?: string;
  /** retail data day (YYYY-MM-DD); read from the ZIP when omitted */
  date?: string;
  /** ingest again files that were already ingested */
  force?: boolean;
}

export type IngestOutcome =
  | { status: "skipped"; previousId: number }
  | { status: "loaded"; inserted: number; updated: number; prices: number; boxes: number };

const seconds = (since: number) => ((Date.now() - since) / 1000).toFixed(1);

/**
 * Reads one day's SEPA files and loads them into the catalog. Retail and wholesale go through one run, so a
 * product sold in both gets the best description among all its chains. Safe to repeat: the same files are skipped.
 */
export async function ingestZip({
  retail,
  wholesale,
  date: dateArg,
  force = false,
}: IngestOptions): Promise<IngestOutcome> {
  const days: Partial<Record<Channel, string>> = { retail: await resolveDate(retail, dateArg) };
  if (wholesale) days.wholesale = await resolveDate(wholesale);

  // one fingerprint for the pair: wholesale arriving later than retail makes the run new
  const hash = createHash("sha256")
    .update(await hashFile(retail))
    .update(wholesale ? await hashFile(wholesale) : "")
    .digest("hex");

  const db = await connect();
  try {
    const previous = await findIngestionByHash(db, hash);
    if (previous && !force) {
      console.log(
        `These files were already ingested (#${previous.id}, ${previous.createdAt.toISOString()}). Use --force to repeat them.`,
      );
      return { status: "skipped", previousId: previous.id };
    }

    const startedAt = Date.now();
    const notices: ZipNotice[] = [];
    const onNotice = (notice: ZipNotice) => {
      notices.push(notice);
      if (notice.status !== "ok")
        console.error(`ZIP ${notice.status}: ${notice.file} ${notice.detail ?? ""}`);
    };
    async function* rows(): AsyncGenerator<ProductRow> {
      yield* readProducts(retail, "retail", onNotice);
      if (wholesale) yield* readProducts(wholesale, "wholesale", onNotice);
    }
    const sources = await aggregateProducts(rows());
    console.log(`${sources.size} products read in ${seconds(startedAt)} s`);

    const products = [...sources].map(([ean, source]) => buildProduct(ean, source, days));
    const result = await withTransaction(db, async () => {
      const { inserted, updated } = await upsertProducts(db, products);
      const prices = await upsertReferencePrices(db, products);
      const boxes = await upsertBulkUnits(db, products);
      await recordIngestion(db, {
        date: days.retail!,
        file: `retail:${basename(retail)}` + (wholesale ? ` wholesale:${basename(wholesale)}` : ""),
        hash,
        zipsProcessed: notices.filter((n) => n.status === "ok").length,
        zipsFailed: notices.filter((n) => n.status === "error").length,
        productsInserted: inserted,
        productsUpdated: updated,
      });
      return { inserted, updated, prices, boxes };
    });
    console.log(
      `Done: ${result.inserted} new, ${result.updated} updated, ${result.prices} prices, ${result.boxes} boxes (${seconds(startedAt)} s in total)`,
    );
    return { status: "loaded", ...result };
  } finally {
    await db.end();
  }
}
