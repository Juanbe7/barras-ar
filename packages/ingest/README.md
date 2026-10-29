# @barras-ar/ingest

Daily ingestion of the SEPA (Precios Claros) dataset. It reads the day's ZIP, builds **one product record per barcode** and loads the catalog into PostgreSQL.

## Commands

Run them from this folder. `load`, `ingest-latest` and `migrate` read `DATABASE_URL` from `.env` (copy `.env.example`; use the Supabase **Session pooler** string).

```bash
npm run migrate                                          # apply db/migrations/*.sql
npm run ingest-latest                                    # download the newest day from the SEPA portal and ingest it
npm run load -- ../../in/sepa_jueves.zip                 # ingest a day you already have (date comes from the ZIP)
npm run load -- ../../in/sepa_jueves.zip --force         # ingest it again even if the file was seen
npm run export-csv -- ../../in/sepa_jueves.zip ../../out/products.csv   # same records, as CSV, no database
```

## How it is organized

```
src/
  domain/    pure rules, no I/O: EAN check digit, units, description and brand choice, product record
  source/    reading SEPA: nested ZIPs, the CSV format, grouping rows by barcode and chain
  db/        PostgreSQL: connection, migrations, catalog upsert, ingestion log
  export/    CSV serialization (also what COPY reads)
  commands/  entry points (migrate, load, export-csv); thin, they only wire the pieces together
test/        unit tests plus a small real fixture (test/fixtures/sepa-mini.zip)
```

Data flows one way: `source` produces rows → `aggregateProducts` groups them → `domain` turns each group into a `Product` → `db` or `export` store it. `domain` imports nothing from the other folders.

## What the rules do

1. Keep rows with `productos_ean = 1` whose check digit is valid; pad the code to 13 digits.
2. For each barcode and chain keep the variant (description, brand, presentation) most repeated across its branches.
3. **Description:** the most complete one (whole words, includes the brand and a presentation).
4. **Brand:** the most common among chains, ignoring empty and "SIN MARCA".
5. **Presentation:** the most common among chains, normalized to g, ml or unit; a generic "1 unit" is ignored if any chain reports a weight or volume.
6. **Search text:** the words of every chain's wording, lowercase and accent-free, so "bagley surtido" and "surtidas bagley" find the same product.
7. **Reference price:** median of each chain's median list price (promotions excluded), plus min and max.

Variants are not stored: they are rebuilt from the source on every ingestion.

## Loading

`load` is idempotent and safe to repeat:

- A file already ingested (same SHA-256) is skipped unless `--force` is given.
- The whole load runs in one transaction: `COPY` into a staging table, then `INSERT ... ON CONFLICT`.
- A product's fields are only overwritten by data from the same day or a newer one, so loading an older day never turns the catalog back. `first_seen` and `last_seen` always widen.
- Empty or corrupt chain ZIPs are reported and skipped; the rest of the day is still processed.

## Daily automation

`.github/workflows/daily-ingest.yml` runs `ingest-latest` every day at 23:00 UTC (20:00 in Argentina) and can also be started by hand from the Actions tab, with an option to force a repeat.

- It needs the repository secret `DATABASE_URL` (Supabase **Session pooler**, port 5432).
- `ingest-latest` asks the portal's CKAN API for the daily ZIP published most recently, so it needs no weekday logic. If today's file is not out yet it finds yesterday's, which is recognized by its hash and skipped.
- It fails, and GitHub emails the repository owner, if the newest file is more than 3 days old (the source stopped publishing), if the download comes out incomplete, or if the load fails. The load is a single transaction, so a failure leaves the catalog as it was.
- GitHub disables scheduled workflows of a public repository after 60 days without repository activity. A commit now and then keeps it alive; otherwise re-enable it in the Actions tab.

## Tests

```bash
npm test
```

`test/fixtures/sepa-mini.zip` is a real "ZIP of ZIPs" with three small chains, an empty one (as SEPA ships it) and a corrupt one made up for the test. `create-fixture.py` rebuilds it from a full day.
