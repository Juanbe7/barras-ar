# @barras-ar/ingest

Daily ingestion of the SEPA (Precios Claros) datasets. It reads the day's retail ZIP (supermarkets) and wholesale ZIP (wholesalers with a sales floor), builds **one product record per barcode** and loads the catalog into PostgreSQL.

## Commands

Run them from this folder. `load`, `ingest-latest` and `migrate` read `DATABASE_URL` from `.env` (copy `.env.example`; use the Supabase **Session pooler** string).

```bash
npm run migrate                                          # apply db/migrations/*.sql
npm run ingest-latest                                    # download the newest retail and wholesale days and ingest them
npm run load -- ../../in/sepa_jueves.zip                 # ingest a retail day you already have (date comes from the ZIP)
npm run load -- ../../in/sepa_jueves.zip --wholesale=../../in/mayorista_jueves.zip   # ...together with its wholesale day
npm run load -- ../../in/sepa_jueves.zip --force         # ingest it again even if the files were seen
npm run export-csv -- ../../in/sepa_jueves.zip ../../out/products.csv   # same records, as CSV, no database
```

## How it is organized

```
src/
  domain/    pure rules, no I/O: EAN check digit, units, description and brand choice, presentation read from
             text, product record
  source/    reading SEPA: nested ZIPs, the CSV format, grouping rows by barcode and chain
  db/        PostgreSQL: connection, migrations, catalog upsert, ingestion log
  export/    CSV serialization (also what COPY reads)
  commands/  entry points (migrate, load, export-csv); thin, they only wire the pieces together
test/        unit tests plus small real fixtures (test/fixtures/)
```

Data flows one way: `source` produces rows → `aggregateProducts` groups them → `domain` turns each group into a `Product` → `db` or `export` store it. `domain` imports nothing from the other folders.

## What the rules do

1. Keep rows with `productos_ean = 1` whose check digit is valid; pad the code to 13 digits.
2. For each barcode and chain keep the variant (description, brand, presentation) most repeated across its branches. Retail and wholesale chains vote together, so a product sold in both gets the best description among all of them.
3. **Description:** the most complete one (whole words, includes the brand and a presentation).
4. **Brand:** the most common among chains, ignoring empty and "SIN MARCA". Wholesale brands match the retail ones 67% to 90% of the time depending on the chain, so they are a complement, not a reference.
5. **Presentation:** the most common among chains, normalized to g, ml or unit; a generic "1 unit" is ignored if any chain reports a weight or volume. Wholesale files carry no presentation, and some retail chains only say "1 unit": then a weight or volume is read from the description ("X 400 GRS", "1.5LT", "3 X 50 G"). A written count ("X 6 UNI") is used only when no presentation is reported at all, since chains often report the net weight of a pack whose description counts pieces. Measured against the products that have both, a written g/ml agrees with the chains' own figure 91% of the time, and a count only 74%.
6. **Search text:** the words of every chain's wording, lowercase and accent-free, so "bagley surtido" and "surtidas bagley" find the same product.
7. **Reference prices, one per channel:** median of each chain's median list price per unit with VAT (promotions excluded), plus min and max. Retail is what supermarkets charge; wholesale is an approximate cost for a shop that buys to resell. They are stored apart (`reference_prices`), because the wholesale median is about 83% of the retail one but 15% of products cost more at wholesalers.
8. **Boxes:** wholesale rows name the box a product comes in (`id_dun_14`) and the units it holds (`unidad_venta`). A box is kept (`bulk_units`) only if its GTIN-14 has a valid check digit, it is not just the unit's own code, it holds more than one unit, and it is declared for a single product. Most raw rows fail one of these.

Variants are not stored: they are rebuilt from the source on every ingestion.

## Loading

`load` is idempotent and safe to repeat:

- Files already ingested are skipped unless `--force` is given. The fingerprint covers the retail and wholesale files together, so a wholesale file that arrives later than the retail one makes a new run.
- The whole load runs in one transaction: `COPY` into a staging table, then `INSERT ... ON CONFLICT`, for products, prices and boxes.
- A product's fields and each price are only overwritten by data from the same day or a newer one, so loading an older day never turns the catalog back. `first_seen` and `last_seen` always widen.
- The wholesale file is a complement: if the portal does not have it, it is stale or it fails to download, `ingest-latest` says so and loads retail alone.
- Empty or corrupt chain ZIPs are reported and skipped; the rest of the day is still processed.

## Daily automation

`.github/workflows/daily-ingest.yml` runs `ingest-latest` every day at 23:00 UTC (20:00 in Argentina) and can also be started by hand from the Actions tab, with an option to force a repeat.

- It needs the repository secret `DATABASE_URL` (Supabase **Session pooler**, port 5432).
- `ingest-latest` asks the portal's CKAN API for the daily ZIP published most recently, in each of the two datasets, so it needs no weekday logic. If today's file is not out yet it finds yesterday's, which is recognized by its hash and skipped.
- It fails, and GitHub emails the repository owner, if the newest file is more than 3 days old (the source stopped publishing), if the download comes out incomplete, or if the load fails. The load is a single transaction, so a failure leaves the catalog as it was.
- GitHub disables scheduled workflows of a public repository after 60 days without repository activity. A commit now and then keeps it alive; otherwise re-enable it in the Actions tab.

## Tests

```bash
npm test
```

`test/fixtures/sepa-mini.zip` is a real retail "ZIP of ZIPs" with three small chains, an empty one (as SEPA ships it) and a corrupt one made up for the test. `sepa-wholesale-mini.zip` is the same for wholesale (two chains with products and one with a header and no rows). `create-fixture.py` and `create-wholesale-fixture.py` rebuild them from a full day.
