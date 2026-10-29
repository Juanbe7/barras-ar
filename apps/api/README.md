# @barras-ar/api

Read-only HTTP API over the BarrasAR catalog. Built with [Hono](https://hono.dev); meant to run on Vercel and read from Supabase (PostgreSQL).

## Endpoints

| Endpoint                            | What it does                                                               |
| ----------------------------------- | -------------------------------------------------------------------------- |
| `GET /products/{ean}`               | One product by barcode (8 to 14 digits). 400 if malformed, 404 if unknown. |
| `GET /products/{ean}/related?limit=` | Products with nearby codes (same manufacturer, often same line), closest first. Works for codes that are not in the catalog, so it is what to show after a 404. `limit` 1–20 (default 8). |
| `GET /products?q=...&limit=&offset=` | Text search: every word of `q` must appear, partial words included. `limit` 1–50 (default 20), `offset` 0–10000. |
| `GET /stats`                        | Number of products and latest data day.                                    |
| `GET /health`                       | `ok`, or 503 if the database is down.                                      |
| `GET /openapi.json`                 | OpenAPI description.                                                       |

Every successful response carries a `source` field with the credit the SEPA license requires. Errors look like `{ "error": { "code": "not_found", "message": "..." } }`.

Search results are ordered by how many chains sell the product, then by barcode; there is no text-relevance ranking.

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
