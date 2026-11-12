# @barras-ar/api

Read-only HTTP API over the BarrasAR catalog. Built with [Hono](https://hono.dev); meant to run on Vercel and read from Supabase (PostgreSQL).

## Endpoints

| Endpoint                            | What it does                                                               |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `GET /products/{code}` | One product by barcode (8 to 14 digits), with its supermarket price (`reference_price`) and wholesale price (`wholesale_price`). A 14-digit wholesale box code (DUN-14) works too: you get the product it holds plus `pack: { code, units }`. 400 if malformed, 404 if unknown. |
| `GET /products/{ean}/related?limit=` | Products with nearby codes (same manufacturer, often same line), closest first. Works for codes that are not in the catalog, so it is what to show after a 404. `limit` 1–20 (default 8). |
| `GET /products?q=...&limit=&offset=` | Text search: every word of `q` must appear, partial words included. `limit` 1–50 (default 20), `offset` 0–10000. |
| `POST /products/batch` | Up to 100 lookups in one request, each by text (`q`) or by barcode (`ean`), with your own `id` per item. Answers one result per item, in order; a bad or unmatched item comes back with `found: false` (plus an `error` if it was invalid) and never fails the batch. The whole batch counts as **one** request for the rate limit. See [Batch lookups](#batch-lookups). |
| `GET /stats`                        | Number of products and latest data day.                                    |
| `GET /health`                       | `ok`, or 503 if the database is down.                                      |
| `GET /openapi.json`                 | OpenAPI description.                                                       |

Every successful response carries a `source` field with the credit the SEPA license requires. Errors look like `{ "error": { "code": "not_found", "message": "..." } }`.

Search results are ordered by how many chains sell the product, then by barcode; there is no text-relevance ranking.

## Batch lookups

For a client that must look up hundreds of products (a bulk import), one request per product would hit the rate limit (60 per minute per IP). `POST /products/batch` answers up to 100 lookups in one request:

```bash
curl -X POST https://barras-ar.vercel.app/products/batch \
  -H "content-type: application/json" \
  -d '{ "items": [
        { "id": "row-2", "q": "alfajor milka", "limit": 3 },
        { "id": "row-3", "ean": "7790040147720" }
      ] }'
```

```json
{
  "results": [
    { "id": "row-2", "found": true, "data": [{ "ean": "7622300457303", "description": "...", "reference_price": { "...": "..." } }] },
    { "id": "row-3", "found": false, "data": [] }
  ],
  "source": "Precios Claros – Base SEPA (CC BY 4.0)"
}
```

- Each item has your own `id` (1 to 64 characters, unique in the batch; it comes back in the result) and **exactly one** of `q` (text search, like `GET /products?q=`) or `ean` (like `GET /products/{ean}`, box codes included). `limit` is 1–20 (default 5) and applies to text items.
- The results come in the same order as the items. `data` has the same product shape as the other endpoints.
- A problem with **one item** (`invalid_item`, `invalid_ean`, `invalid_query`, `invalid_limit`, or `internal_error`) is reported on that item and the rest is answered. A problem with the **request** is a 400: not JSON (`invalid_json`), no `items` (`invalid_body`), empty (`invalid_items`), more than 100 items (`batch_too_large`), or a missing or repeated `id` (`invalid_id`, `duplicate_id`). A body over 100 KB is a 413.
- Up to 8 lookups run at the same time, so a full batch does not exhaust the database pool.
- It is not cached at the edge (`Cache-Control: no-store`): clients that care should cache on their side. The catalog changes once a day.

## Run it

```bash
cp .env.example .env        # DATABASE_URL: Supabase Transaction pooler (port 6543)
npm run dev                 # http://localhost:3000
```

## Tests

```bash
npm test                    # unit tests, no database needed
npm run test:integration    # queries a real catalog through DATABASE_URL (.env)
```

## How it is organized

```
src/
  create-app.ts        routes, validation, error handling; receives its dependencies
  products/
    repository.ts      the ProductRepository interface and its PostgreSQL implementation
    presenter.ts       database record -> public JSON
    search-query.ts    turns the user's text into search words
    lookup.ts          barcode lookup shared by GET /products/{code} and the batch (box codes included)
    batch.ts           POST /products/batch: request checks and bounded-concurrency execution
  rate-limit.ts        per-client request limiter
  openapi.ts           API description
  db.ts                connection pool
  index.ts             wires the real dependencies (what Vercel serves)
  dev-server.ts        local development server
```

`createApp` takes the repository and the rate limiter as arguments, so the routes are tested with in-memory fakes and no database.

## Things to know

- **Caching:** the catalog changes once a day, so product and search responses are cacheable at the edge for an hour (`s-maxage`). That is what keeps the free database quiet.
- **Rate limit:** the in-memory limiter (60 requests per minute per IP) is a per-instance brake. Serverless instances do not share memory, so the real shared limit has to be a Vercel Firewall rate-limit rule.
- **Search normalization:** `search-query.ts` must normalize like the ingestion does when it builds `search_text` (`searchWords` in `packages/ingest`). If one changes, change the other.
- **Connection:** use the Transaction pooler (port 6543). The ingestion uses the Session pooler instead, because it needs `COPY` and a transaction spanning several statements.
