-- BarrasAR catalog (PostgreSQL / Supabase).
-- One row per barcode: a derived record that the daily ingestion recomputes from the SEPA files.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TABLE products (
    ean           char(13) PRIMARY KEY,   -- barcode, 13 digits with leading zeros
    description   text NOT NULL,          -- the most complete description among the chains
    brand         text,                   -- the brand most chains agree on
    quantity      numeric(12,2),          -- presentation, normalized
    unit          text,                   -- g, ml or unit
    category      text,                   -- inferred from keywords (not built yet)
    search_text   text,                   -- words from every chain's wording, lowercase, no accents, no repeats
    price_median  numeric(12,2),          -- national list price, promotions excluded
    price_min     numeric(12,2),
    price_max     numeric(12,2),
    chains        smallint,               -- in how many chains the code appears
    data_date     date NOT NULL,          -- day of the data the fields above were computed from
    first_seen    date NOT NULL,          -- first day the code showed up in the data
    last_seen     date NOT NULL,          -- last day the code showed up in the data

    CONSTRAINT products_ean_format CHECK (ean ~ '^[0-9]{13}$'),
    CONSTRAINT products_unit_valid CHECK (unit IN ('g', 'ml', 'unit')),
    CONSTRAINT products_price_order CHECK (price_min <= price_median AND price_median <= price_max)
);

-- Partial-text search ("surtid" + "bagley"): LIKE '%...%' served by a trigram index.
CREATE INDEX products_search_idx ON products USING gin (search_text extensions.gin_trgm_ops);

CREATE TABLE ingestions (
    id                 serial PRIMARY KEY,
    data_date          date NOT NULL,
    file               text NOT NULL,
    hash               text NOT NULL UNIQUE,   -- to avoid processing the same file twice
    zips_processed     int,
    zips_failed        int,
    products_inserted  int,
    products_updated   int,
    created_at         timestamptz NOT NULL DEFAULT now()
);
