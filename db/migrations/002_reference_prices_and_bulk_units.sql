-- Prices move out of `products` into their own table, one row per barcode and channel (retail and wholesale),
-- and wholesale boxes (DUN-14 codes) get a table of their own.
--
-- This migration only ADDS. The old products.price_* columns stay until the code that read them is deployed
-- (migration 003 drops them), so the API that is live keeps working while the new one rolls out.

CREATE TABLE reference_prices (
    ean           char(13) NOT NULL REFERENCES products (ean) ON DELETE CASCADE,
    channel       text NOT NULL,              -- retail: supermarkets; wholesale: wholesalers with a sales floor
    price_median  numeric(12,2) NOT NULL,     -- national list price per unit with VAT, promotions excluded
    price_min     numeric(12,2) NOT NULL,
    price_max     numeric(12,2) NOT NULL,
    chains        smallint NOT NULL,          -- chains of this channel behind the price
    data_date     date NOT NULL,              -- day of the file the price comes from

    PRIMARY KEY (ean, channel),
    CONSTRAINT reference_prices_channel_valid CHECK (channel IN ('retail', 'wholesale')),
    CONSTRAINT reference_prices_order CHECK (price_min <= price_median AND price_median <= price_max)
);

-- the retail prices that already live in products
INSERT INTO reference_prices (ean, channel, price_median, price_min, price_max, chains, data_date)
SELECT ean, 'retail', price_median, price_min, price_max, COALESCE(chains, 1), data_date
FROM products
WHERE price_median IS NOT NULL;

CREATE TABLE bulk_units (
    dun14  char(14) PRIMARY KEY,              -- code of the box (GTIN-14)
    ean    char(13) NOT NULL REFERENCES products (ean) ON DELETE CASCADE,
    units  int NOT NULL,                      -- units of the product inside the box

    CONSTRAINT bulk_units_dun14_format CHECK (dun14 ~ '^[0-9]{14}$'),
    CONSTRAINT bulk_units_units_valid CHECK (units > 1)
);

CREATE INDEX bulk_units_ean_idx ON bulk_units (ean);
