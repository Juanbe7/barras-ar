# @barras-ar/web

Mobile web app (PWA) for BarrasAR: scan a barcode or search by name and see the typical (median), minimum and maximum reference price. Vanilla TypeScript with [Vite](https://vite.dev); no UI framework.

## Run it

```bash
cp .env.example .env     # VITE_API_URL: where the API runs
npm run dev              # http://localhost:5173
```

The camera needs HTTPS or `localhost`. To try it on a phone, deploy a preview (Vercel gives HTTPS) or tunnel the dev server.

## Tests

```bash
npm test                 # pure logic: barcode, formatting, routes, history, HTTP client
npm run typecheck
npm run build
```

## How it is organized

```
src/
  main.ts            entry point
  config.ts          API URL from VITE_API_URL
  app/               startApp (route -> screen) and the context every screen receives
  router/            hash routes: parsing (pure) and navigation
  api/               HTTP client, error kinds, products endpoints, response types
  domain/            pure functions: barcode check digit, price formatting, price position
  storage/           recently viewed products (localStorage, never throws)
  scanner/           BarcodeScanner interface, native BarcodeDetector, ZXing fallback, camera access
  screens/           one folder per screen: home, scan, search, product
  ui/                small reusable components, each with its own CSS
  styles/            design tokens (light and dark) and base styles
```

Each screen is a factory `(ctx, ...params) => { element, dispose }`; `dispose` runs when the person leaves (the scan screen uses it to release the camera).

## Things to know

- **Scanning:** Chrome on Android uses the browser's `BarcodeDetector`. Everywhere else (Safari on iPhone) the ZXing library is downloaded on demand, so it costs nothing where it is not needed. A read is accepted only if its GS1 check digit is valid, which discards misreads.
- **Routes** live in the URL hash (`#/product/7790040147720`), so the app is a static site and needs no server rewrites.
- **Price shown:** the median, labelled "Precio típico", because one wrongly reported price moves it less than the mean.
- **CORS:** the API allows any origin, so the app calls it directly.

## Deploy

Static site. On Vercel: import the repository, set **Root Directory** to `apps/web`, and add the `VITE_API_URL` environment variable pointing to the deployed API.
