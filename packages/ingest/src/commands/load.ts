import { basename } from "node:path";
import { connect, withTransaction } from "../db/connect.js";
import { upsertProducts } from "../db/catalog.js";
import { findIngestionByHash, recordIngestion } from "../db/ingestions.js";
import { buildProduct } from "../domain/product.js";
import { aggregateProducts } from "../source/aggregate.js";
import { hashFile } from "../source/file-hash.js";
import { readProducts, resolveDate, type ZipNotice } from "../source/reader.js";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const [path, dateArg] = args.filter((arg) => !arg.startsWith("--"));
  if (!path) {
    console.error("Usage: npm run load -- ../../in/sepa_jueves.zip [YYYY-MM-DD] [--force]");
    process.exit(1);
  }
  const date = await resolveDate(path, dateArg);
  const hash = await hashFile(path);

  const db = await connect();
  try {
    const previous = await findIngestionByHash(db, hash);
    if (previous && !force) {
      console.log(
        `This file was already ingested (#${previous.id}, ${previous.createdAt.toISOString()}). Use --force to repeat it.`,
      );
      return;
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
    console.log(`${sources.size} products read in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);

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
    console.log(
      `Done: ${inserted} new, ${updated} updated (${((Date.now() - startedAt) / 1000).toFixed(1)} s in total)`,
    );
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
