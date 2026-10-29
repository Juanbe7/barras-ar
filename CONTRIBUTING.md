# Contributing to BarrasAR

Thanks for helping. This project turns the public SEPA price data into a clean catalog of Argentine products by barcode.

## Setup

Requires Node 22+.

```bash
npm install
npm test
```

To run the ingestion against a database you need a PostgreSQL connection string in `packages/ingest/.env` (see `.env.example`) and a daily SEPA ZIP from the [official dataset](https://datos.produccion.gob.ar/dataset/sepa-precios). ZIPs go in `in/`, which is git-ignored.

## Before opening a pull request

```bash
npm run format
npm run lint
npm run typecheck
npm test
```

## Conventions

- **Code in English**: identifiers, comments, commit messages, SQL names and the API contract. User-facing documentation (README) is in Spanish.
- **Keep the domain pure**: `packages/ingest/src/domain` must not do I/O or import from `source`, `db` or `export`.
- **Commands stay thin**: `commands/*` only wire pieces together; logic goes in a module with tests.
- **Comments explain why**, not what.
- **Tests**: new rules need a test. Prefer real cases taken from the data (see the Bagley examples).
- **Database changes** are new numbered files in `db/migrations/`. Never edit a migration that was already released.

## Data rules

The description, brand and presentation rules are measured against a hand-reviewed sample (`muestras/`). If you change a rule, say how it affects that sample.

The data is licensed CC BY 4.0 and comes from Precios Claros – Base SEPA. Keep the attribution and do not add brand logos or images.
