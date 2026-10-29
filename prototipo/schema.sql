-- Modelo de datos de BarrasAR (PostgreSQL / Supabase).
-- Medido con el jueves 29/10/2026: 76.581 filas, entre 25 y 28 MB con el índice de búsqueda.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE productos (
    ean             char(13) PRIMARY KEY,      -- código de barras, 13 dígitos con ceros a la izquierda
    descripcion     text NOT NULL,             -- la mejor descripción entre las cadenas
    marca           text,                      -- la marca más repetida
    cantidad        numeric(12,2),             -- presentación normalizada
    unidad          text,                      -- g, ml o unidad
    categoria       text,                      -- inferida por palabras clave (pendiente)
    texto_busqueda  text,                      -- palabras de todas las variantes, sin tildes ni repetir
    precio_mediana  numeric(12,2),             -- precio de lista nacional, sin promociones
    precio_min      numeric(12,2),
    precio_max      numeric(12,2),
    cadenas         smallint,                  -- en cuántas cadenas aparece
    fecha_precio    date,
    primera_vez     date,
    ultima_vez      date
);

-- Búsqueda por texto parcial ("surtid" + "bagley"): 18 ms sobre 76.581 productos.
CREATE INDEX productos_busqueda ON productos USING gin (texto_busqueda gin_trgm_ops);

CREATE TABLE ingestas (
    id                  serial PRIMARY KEY,
    fecha               date NOT NULL,
    archivo             text NOT NULL,
    hash                text NOT NULL UNIQUE,  -- para no procesar dos veces el mismo archivo
    zips_procesados     int,
    zips_con_error      int,
    productos_nuevos    int,
    productos_actualizados int,
    creado              timestamptz DEFAULT now()
);

-- Ejemplos de consulta
-- SELECT * FROM productos WHERE ean = '7790040147720';
-- SELECT ean, descripcion FROM productos
--   WHERE texto_busqueda LIKE ALL (ARRAY['%surtid%', '%bagley%'])
--   ORDER BY cadenas DESC LIMIT 20;
