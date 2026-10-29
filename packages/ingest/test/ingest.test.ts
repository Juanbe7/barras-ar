import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isBoxCode, isValidEan } from "../src/domain/ean.js";
import { buildProduct, median } from "../src/domain/product.js";
import { CSV_HEADER, csvLines } from "../src/export/csv.js";
import { aggregateProducts } from "../src/source/aggregate.js";
import {
  readProducts,
  readProductsCsv,
  zipDate,
  type ProductRow,
  type ZipNotice,
} from "../src/source/reader.js";

const RETAIL_ZIP = fileURLToPath(new URL("./fixtures/sepa-mini.zip", import.meta.url));
const WHOLESALE_ZIP = fileURLToPath(new URL("./fixtures/sepa-wholesale-mini.zip", import.meta.url));

async function* fromArray(rows: ProductRow[]) {
  yield* rows;
}

const row = (overrides: Partial<ProductRow> = {}): ProductRow => ({
  channel: "retail",
  chainId: "1",
  code: "7790040147720",
  isEan: true,
  description: "GALLETITAS SURTIDO BAGLEY X 400 GRS",
  quantity: "400",
  unit: "gr",
  brand: "BAGLEY",
  listPrice: "3850",
  boxCode: "",
  boxUnits: "",
  ...overrides,
});

describe("readProducts (retail)", () => {
  it("reads the good chains and reports the empty and the corrupt ones without stopping", async () => {
    const notices: ZipNotice[] = [];
    let rows = 0;
    for await (const r of readProducts(RETAIL_ZIP, "retail", (n) => notices.push(n))) {
      rows++;
      expect(r.code).not.toBe("");
      expect(r.channel).toBe("retail");
    }
    expect(rows).toBeGreaterThan(0);
    const filesWith = (status: ZipNotice["status"]) =>
      notices.filter((n) => n.status === status).map((n) => n.file);
    expect(filesWith("ok")).toHaveLength(3);
    expect(filesWith("empty")).toEqual([expect.stringContaining("comercio-sepa-36")]);
    expect(filesWith("error")).toEqual([expect.stringContaining("comercio-sepa-99")]);
  });

  it("drops the trailing 'Ultima actualizacion' line and leaves no BOM in the data", async () => {
    for await (const r of readProducts(RETAIL_ZIP)) {
      expect(r.chainId).toMatch(/^\d+$/);
      expect(r.description).not.toMatch(/Ultima actualizacion/i);
    }
  });
});

describe("readProducts (wholesale)", () => {
  it("reads the wholesale columns: unit price, no presentation", async () => {
    const notices: ZipNotice[] = [];
    let rows = 0;
    for await (const r of readProducts(WHOLESALE_ZIP, "wholesale", (n) => notices.push(n))) {
      rows++;
      expect(r.channel).toBe("wholesale");
      expect(r.quantity).toBe("");
      expect(r.unit).toBe("");
      expect(Number(r.listPrice)).toBeGreaterThan(0);
      expect(r.description).not.toMatch(/Ultima actualizacion/i);
    }
    expect(rows).toBeGreaterThan(1000);
    // chain 68 ships a header and no rows; it still counts as read
    expect(notices.map((n) => n.status)).toEqual(["ok", "ok", "ok"]);
  });

  it("parses a wholesale CSV: box code and units, price per unit with VAT", async () => {
    const csv =
      "﻿id_comercio|id_bandera|id_sucursal|id_producto|productos_ean|id_dun_14|productos_descripcion|productos_marca|" +
      "precio_unitario_bulto_por_unidad_venta_con_iva|unidad_venta\r\n" +
      "70|1|1|7790060023684|1|57790060023689|ACEITE DE GIRASOL COCINERO 1.5 LT|MOLINOS|5700.00|12\r\n" +
      "\r\nUltima actualizacion: 2026-10-29T16:00:00-03:00";
    const rows: ProductRow[] = [];
    for await (const r of readProductsCsv(Readable.from([csv]), "wholesale")) rows.push(r);
    expect(rows).toEqual([
      {
        channel: "wholesale",
        chainId: "70",
        code: "7790060023684",
        isEan: true,
        description: "ACEITE DE GIRASOL COCINERO 1.5 LT",
        quantity: "",
        unit: "",
        brand: "MOLINOS",
        listPrice: "5700.00",
        boxCode: "57790060023689",
        boxUnits: "12",
      },
    ]);
  });
});

describe("zipDate", () => {
  it("reads the day from the folder name", async () => {
    expect(await zipDate(RETAIL_ZIP)).toBe("2026-10-29");
    expect(await zipDate(WHOLESALE_ZIP)).toBe("2026-10-29");
  });
});

describe("aggregateProducts + buildProduct", () => {
  it("builds a valid record for every retail barcode", async () => {
    const sources = await aggregateProducts(readProducts(RETAIL_ZIP));
    expect(sources.size).toBe(359);
    for (const [ean, source] of sources) {
      expect(ean).toMatch(/^\d{13}$/);
      expect(isValidEan(ean)).toBe(true);
      const product = buildProduct(ean, source, { retail: "2026-10-29" });
      expect(product.description).not.toBe("");
      expect(product.chains).toBeGreaterThan(0);
      expect(product.searchText).toBe(product.searchText.toLowerCase());
      for (const price of product.prices) {
        expect(price.channel).toBe("retail");
        expect(price.min).toBeLessThanOrEqual(price.median);
        expect(price.median).toBeLessThanOrEqual(price.max);
      }
    }
  });

  it("drops internal codes (productos_ean = 0)", async () => {
    const sources = await aggregateProducts(readProducts(RETAIL_ZIP));
    // 0000000023897 is an internal code of chain 3 and must not get in
    expect(sources.has("0000000023897")).toBe(false);
  });

  it("brings in the wholesale-only products and gives each channel its own price", async () => {
    async function* both() {
      yield* readProducts(RETAIL_ZIP, "retail");
      yield* readProducts(WHOLESALE_ZIP, "wholesale");
    }
    const sources = await aggregateProducts(both());
    const days = { retail: "2026-10-29", wholesale: "2026-10-29" } as const;
    const products = [...sources].map(([ean, source]) => buildProduct(ean, source, days));

    const channelsOf = (p: (typeof products)[number]) => p.prices.map((x) => x.channel).sort();
    expect(products.filter((p) => channelsOf(p).join() === "wholesale").length).toBeGreaterThan(1000);
    expect(products.filter((p) => channelsOf(p).join() === "retail,wholesale").length).toBeGreaterThan(0);
  });
});

describe("a product sold through both channels", () => {
  const retailRow = row();
  const wholesaleRow = row({
    channel: "wholesale",
    chainId: "70",
    description: "GALLETITAS SURTIDO BAGLEY X 400 GRS",
    quantity: "",
    unit: "",
    listPrice: "2900",
  });

  it("keeps one price per channel, each from its own chains", async () => {
    const sources = await aggregateProducts(fromArray([retailRow, retailRow, wholesaleRow]));
    const product = buildProduct("7790040147720", sources.get("7790040147720")!, {
      retail: "2026-10-29",
      wholesale: "2026-10-28",
    });
    expect(product.prices).toEqual([
      { channel: "retail", median: 3850, min: 3850, max: 3850, chains: 1, dataDate: "2026-10-29" },
      { channel: "wholesale", median: 2900, min: 2900, max: 2900, chains: 1, dataDate: "2026-10-28" },
    ]);
    expect(product.chains).toBe(2);
    expect(product.dataDate).toBe("2026-10-29");
  });

  it("leaves out the prices of a channel that was not part of the run", async () => {
    const sources = await aggregateProducts(fromArray([retailRow, wholesaleRow]));
    const product = buildProduct("7790040147720", sources.get("7790040147720")!, { retail: "2026-10-29" });
    expect(product.prices.map((p) => p.channel)).toEqual(["retail"]);
  });

  it("reads the presentation from the description when no chain reports one", async () => {
    const sources = await aggregateProducts(fromArray([wholesaleRow]));
    const product = buildProduct("7790040147720", sources.get("7790040147720")!, { wholesale: "2026-10-29" });
    expect(product.quantity).toBe(400);
    expect(product.unit).toBe("g");
  });

  it("replaces a generic '1 unit' with a written weight or volume, but not with a written count", async () => {
    const generic = (description: string) => row({ description, quantity: "1", unit: "uni" });
    const build = async (description: string) => {
      const sources = await aggregateProducts(fromArray([generic(description)]));
      return buildProduct("7790040147720", sources.get("7790040147720")!, { retail: "2026-10-29" });
    };
    expect(await build("BOWL ROSA 550ML")).toMatchObject({ quantity: 550, unit: "ml" });
    // the chain says 1 unit; "X 6 UNI" in the text is not trusted over it
    expect(await build("TE FILTRO X 6 UNI")).toMatchObject({ quantity: 1, unit: "unit" });
  });

  it("uses a written count when nothing else says what the presentation is", async () => {
    const sources = await aggregateProducts(
      fromArray([
        row({ channel: "wholesale", quantity: "", unit: "", description: "PAPEL HIG CAMPANITA X 4 UNI" }),
      ]),
    );
    const product = buildProduct("7790040147720", sources.get("7790040147720")!, { wholesale: "2026-10-29" });
    expect(product).toMatchObject({ quantity: 4, unit: "unit" });
  });

  it("prefers the chains' own presentation over the description's", async () => {
    const sources = await aggregateProducts(fromArray([row({ quantity: "360", unit: "gr" }), wholesaleRow]));
    const product = buildProduct("7790040147720", sources.get("7790040147720")!, { retail: "2026-10-29" });
    expect(product.quantity).toBe(360);
  });

  it("needs the day of at least one channel", async () => {
    const sources = await aggregateProducts(fromArray([retailRow]));
    expect(() => buildProduct("7790040147720", sources.get("7790040147720")!, {})).toThrow(/day/);
  });
});

describe("wholesale boxes (DUN-14)", () => {
  const OIL = "7790060023684";
  const OIL_BOX = "57790060023689"; // a real box of 12 from the wholesale data
  const wholesale = (overrides: Partial<ProductRow> = {}) =>
    row({ channel: "wholesale", code: OIL, boxCode: OIL_BOX, boxUnits: "12", ...overrides });

  const boxesOf = async (rows: ProductRow[], ean = OIL) => {
    const sources = await aggregateProducts(fromArray(rows));
    return [...(sources.get(ean)?.boxes ?? [])].map(([code, units]) => [code, [...units]]);
  };

  it("keeps a valid box with its units", async () => {
    expect(await boxesOf([wholesale()])).toEqual([[OIL_BOX, [[12, 1]]]]);
  });

  it("counts how many times each number of units is reported", async () => {
    const boxes = await boxesOf([wholesale(), wholesale({ chainId: "2" }), wholesale({ boxUnits: "6" })]);
    expect(boxes).toEqual([
      [
        OIL_BOX,
        [
          [12, 2],
          [6, 1],
        ],
      ],
    ]);
  });

  it("discards what is not a box of that product", async () => {
    expect(await boxesOf([wholesale({ boxCode: "57790060023688" })])).toEqual([]); // bad check digit
    expect(await boxesOf([wholesale({ boxCode: `0${OIL}` })])).toEqual([]); // the unit itself
    expect(await boxesOf([wholesale({ boxCode: "" })])).toEqual([]);
    expect(await boxesOf([wholesale({ boxCode: "5779006002368" })])).toEqual([]); // 13 digits
  });

  it("discards boxes that hold a single unit or an unreadable number", async () => {
    expect(await boxesOf([wholesale({ boxUnits: "1" })])).toEqual([]);
    expect(await boxesOf([wholesale({ boxUnits: "" })])).toEqual([]);
    expect(await boxesOf([wholesale({ boxUnits: "2.5" })])).toEqual([]);
  });

  it("does not trust a box code declared for two different products", async () => {
    const other = "7790060023691"; // another valid EAN
    const sources = await aggregateProducts(fromArray([wholesale(), wholesale({ code: other })]));
    expect(sources.get(OIL)?.boxes.size).toBe(0);
    expect(sources.get(other)?.boxes.size).toBe(0);
  });

  it("builds the box with the units most chains agree on", async () => {
    const sources = await aggregateProducts(
      fromArray([wholesale(), wholesale({ chainId: "2" }), wholesale({ boxUnits: "6" })]),
    );
    const product = buildProduct(OIL, sources.get(OIL)!, { wholesale: "2026-10-29" });
    expect(product.bulkUnits).toEqual([{ dun14: OIL_BOX, units: 12 }]);
  });
});

describe("isBoxCode", () => {
  it("accepts a GTIN-14 with a valid check digit that is not the unit's own code", () => {
    expect(isBoxCode("57790060023689", "7790060023684")).toBe(true);
    expect(isBoxCode("17793253003644", "7793253003647")).toBe(true);
  });

  it("rejects a wrong check digit, a wrong length and the unit's own code", () => {
    expect(isBoxCode("57790060023688", "7790060023684")).toBe(false);
    expect(isBoxCode("5779006002368", "7790060023684")).toBe(false);
    expect(isBoxCode("07790060023684", "7790060023684")).toBe(false);
  });
});

describe("csvLines", () => {
  it("writes one line per product, with NULL as an empty cell and quotes escaped", () => {
    const [line] = csvLines([
      {
        ean: "7790040147720",
        description: 'LECHE "ENTERA", 1 L',
        brand: "",
        quantity: 1000,
        unit: "ml",
        category: null,
        searchText: "leche entera 1 l",
        chains: 3,
        dataDate: "2026-10-29",
        prices: [],
        bulkUnits: [],
      },
    ]);
    expect(line).toBe('7790040147720,"LECHE ""ENTERA"", 1 L",,1000,ml,,leche entera 1 l,3,2026-10-29\n');
    expect(CSV_HEADER.trim().split(",")).toHaveLength(9);
  });
});

describe("median", () => {
  it("handles odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("refuses an empty list", () => {
    expect(() => median([])).toThrow();
  });
});
