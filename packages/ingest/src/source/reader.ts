import { parse } from "csv-parse";
import type { Readable } from "node:stream";
import yauzl from "yauzl";

/** A row of a chain's productos.csv, with the columns the catalog uses. */
export interface ProductRow {
  chainId: string;
  code: string;
  isEan: boolean;
  description: string;
  quantity: string;
  unit: string;
  brand: string;
  listPrice: string;
}

export interface ZipNotice {
  file: string;
  status: "ok" | "empty" | "error";
  detail?: string;
}

const openZip = (source: string | Buffer) =>
  new Promise<yauzl.ZipFile>((resolve, reject) => {
    // no autoClose: entries are listed first and read later, so the file is closed by hand
    const options = { lazyEntries: true, autoClose: false };
    const done = (err: Error | null, zip?: yauzl.ZipFile) => (err || !zip ? reject(err) : resolve(zip));
    if (typeof source === "string") yauzl.open(source, options, done);
    else yauzl.fromBuffer(source, options, done);
  });

const listEntries = (zip: yauzl.ZipFile) =>
  new Promise<yauzl.Entry[]>((resolve, reject) => {
    const entries: yauzl.Entry[] = [];
    zip.on("entry", (entry: yauzl.Entry) => {
      entries.push(entry);
      zip.readEntry();
    });
    zip.on("end", () => resolve(entries));
    zip.on("error", reject);
    zip.readEntry();
  });

const openEntry = (zip: yauzl.ZipFile, entry: yauzl.Entry) =>
  new Promise<Readable>((resolve, reject) =>
    zip.openReadStream(entry, (err, stream) => (err || !stream ? reject(err) : resolve(stream))),
  );

async function toBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Day (YYYY-MM-DD) of the folder inside the daily ZIP, if it has one. */
export async function zipDate(path: string): Promise<string | null> {
  const zip = await openZip(path);
  try {
    for (const entry of await listEntries(zip)) {
      const match = /^(\d{4}-\d{2}-\d{2})\//.exec(entry.fileName);
      if (match) return match[1] ?? null;
    }
    return null;
  } finally {
    zip.close();
  }
}

/** The data day: the one given explicitly, or else the folder name inside the ZIP. */
export async function resolveDate(path: string, explicit?: string): Promise<string> {
  const date = explicit ?? (await zipDate(path));
  if (!date) throw new Error("Could not read the date from the ZIP; pass it as an argument (YYYY-MM-DD)");
  return date;
}

/** Rows of a productos.csv: "|" separated, UTF-8 with BOM, CRLF; the trailing text line is dropped. */
export async function* readProductsCsv(csv: Readable): AsyncGenerator<ProductRow> {
  const parser = csv.pipe(
    parse({
      delimiter: "|",
      bom: true,
      columns: (header: string[]) => header.map((h) => h.trim()),
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: false,
    }),
  );
  for await (const row of parser as AsyncIterable<Record<string, string | undefined>>) {
    // the final "Ultima actualizacion: ..." line arrives with a single column
    if (row.productos_precio_lista === undefined) continue;
    yield {
      chainId: (row.id_comercio ?? "").trim(),
      code: (row.id_producto ?? "").trim(),
      isEan: (row.productos_ean ?? "").trim() === "1",
      description: (row.productos_descripcion ?? "").trim(),
      quantity: (row.productos_cantidad_presentacion ?? "").trim(),
      unit: (row.productos_unidad_medida_presentacion ?? "").trim(),
      brand: (row.productos_marca ?? "").trim(),
      listPrice: (row.productos_precio_lista ?? "").trim(),
    };
  }
}

/**
 * Walks the day's "ZIP of ZIPs" and yields the product rows of every chain.
 * Empty or corrupt chain ZIPs are reported through `onNotice` and skipped.
 */
export async function* readProducts(
  path: string,
  onNotice: (notice: ZipNotice) => void = () => {},
): AsyncGenerator<ProductRow> {
  const outer = await openZip(path);
  try {
    const chainZips = (await listEntries(outer)).filter((e) => e.fileName.endsWith(".zip"));
    for (const entry of chainZips) {
      if (entry.uncompressedSize === 0) {
        onNotice({ file: entry.fileName, status: "empty" });
        continue;
      }
      let inner: yauzl.ZipFile | undefined;
      try {
        inner = await openZip(await toBuffer(await openEntry(outer, entry)));
        const csv = (await listEntries(inner)).find((e) => e.fileName.endsWith("productos.csv"));
        if (!csv) throw new Error("the ZIP has no productos.csv");
        yield* readProductsCsv(await openEntry(inner, csv));
        onNotice({ file: entry.fileName, status: "ok" });
      } catch (err) {
        onNotice({ file: entry.fileName, status: "error", detail: (err as Error).message });
      } finally {
        inner?.close();
      }
    }
  } finally {
    outer.close();
  }
}
