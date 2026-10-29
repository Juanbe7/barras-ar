import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { buildProduct } from "../domain/product.js";
import { CSV_HEADER, csvLines } from "../export/csv.js";
import { aggregateProducts } from "../source/aggregate.js";
import { readProducts, resolveDate } from "../source/reader.js";

async function main() {
  const [input, output, dateArg] = process.argv.slice(2);
  if (!input || !output) {
    console.error(
      "Usage: npm run export-csv -- ../../in/sepa_jueves.zip ../../out/products.csv [YYYY-MM-DD]",
    );
    process.exit(1);
  }
  const date = await resolveDate(input, dateArg);
  const startedAt = Date.now();

  const sources = await aggregateProducts(
    readProducts(input, (notice) => {
      if (notice.status !== "ok")
        console.error(`ZIP ${notice.status}: ${notice.file} ${notice.detail ?? ""}`);
    }),
  );

  function* lines() {
    yield CSV_HEADER;
    for (const [ean, source] of sources) yield* csvLines([buildProduct(ean, source, date)]);
  }
  mkdirSync(dirname(output), { recursive: true });
  await pipeline(Readable.from(lines()), createWriteStream(output));
  console.error(
    `${sources.size} products written to ${output} (${((Date.now() - startedAt) / 1000).toFixed(1)} s)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
