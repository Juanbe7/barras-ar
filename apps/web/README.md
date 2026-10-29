# @barras-ar/web

Mobile web app (PWA) for BarrasAR: scan a barcode or search by name and see the typical (median), minimum and maximum reference price, drawn as a supermarket shelf label. Vanilla TypeScript with [Vite](https://vite.dev); no UI framework. The interface is in Spanish, the code and comments are in English.

## What it does

| Screen | Route | What happens |
| --- | --- | --- |
| Home | `#/` | Big "scan" button, a search box with live suggestions (names or barcodes), the last products seen. |
| Scan | `#/scan` | Camera viewfinder, flash button when the phone has one. Opens the product once a code is read. |
| Search | `#/search/<text>` | Results with their typical price, paginated ("Ver más"). |
| Product | `#/product/<ean>` | A shelf label: typical price, a ruler from the minimum to the maximum, and the product's real EAN-13 barcode. |
| Not found | (same route) | Says the code is not in the catalog and, when the API has them, lists related products (same manufacturer) under a heading that says they are not the scanned product. |

Light and dark themes follow the system and can be switched with the button in the app bar.

## Run it

```bash
cp .env.example .env     # VITE_API_URL: where the API runs
npm run dev              # http://localhost:5173
```

The camera needs HTTPS or `localhost`. To try it on a phone, deploy a preview (Vercel gives HTTPS) or tunnel the dev server.

## Tests

```bash
npm test                 # pure logic, no browser needed
npm run typecheck
npm run build
```

The tests cover the barcode check digit, the EAN-13 encoder (its output is decoded back with ZXing), price and date formatting, routes, the recent-products history, the theme store, the HTTP client, the debounce and timeout helpers, the flash switch, the repeated-read confirmation and the wording of the related-products list. Screens and components are plain DOM code and are checked by running the app.

## How it is organized

```
src/
  main.ts            entry point: fonts, styles, startApp
  config.ts          API URL from VITE_API_URL
  app/               startApp (draws the app bar once, shows the screen of the route) and the context
  router/            hash routes: parsing (pure) and navigation
  api/               HTTP client, error kinds, products endpoints, response types
  domain/            pure functions: barcode check digit, EAN-13 encoder, formatting, price position,
                     suggestions rule, related-products wording
  storage/           recently viewed products and theme (localStorage, never throw)
  scanner/           BarcodeScanner interface, native BarcodeDetector, ZXing fallback, camera access,
                     flash switch, repeated-read confirmation
  screens/           one folder per screen: home, scan, search, product (found and not found)
  ui/                small reusable components, each with its own CSS
  styles/            design tokens (light and dark) and base styles
  util/              debounce, timeout
```

Each screen is a factory `(ctx, ...params) => { element, dispose }`; `dispose` runs when the person leaves (the scan screen uses it to release the camera, the search box to drop pending requests). The `ctx` carries the API client, the on-device history and theme, and navigation.

## Things to know

- **Scanning:** Chrome on Android uses the browser's `BarcodeDetector`. Everywhere else (Safari on iPhone) the ZXing library is downloaded on demand, so it costs nothing where it is not needed.
- **Misreads:** a read is ignored if its GS1 check digit is invalid, and a code is accepted only after the camera reads it three times in a row. The check digit alone is not enough: a real scan once misread three digits in a way that kept the check digit valid (`8→2`, `1→7`, `8→2` change the weighted sum by −30).
- **Flash:** the button shows only when the camera reports a torch, which is Chrome on Android; Safari on iPhone does not allow it.
- **Related products** come from `GET /products/{ean}/related`. They are a bonus: the app waits up to 1.5 s for them and, if the request fails or is late, shows the plain "not found" message centered. The layout is decided once, so it does not jump when the list arrives.
- **Barcode on the label:** drawn as SVG from the code, ink on white in both themes so another phone can scan it from the screen.
- **Routes** live in the URL hash (`#/product/7790040147720`), so the app is a static site and needs no server rewrites.
- **Price shown:** the median, labelled "Precio típico", because one wrongly reported price moves it less than the mean.
- **Design:** a shelf-label world. Ink app bar, signal yellow for the label, the main action and the brand mark, Barlow Condensed for prices and titles (bundled with `@fontsource`, so no request goes to a font server). The tokens are in `src/styles/tokens.css`.
- **Motion:** the label drops in and the marker slides along the ruler; the scanner has a sweeping line. Everything stops under `prefers-reduced-motion`.
- **CORS:** the API allows any origin, so the app calls it directly.
- **Not included yet:** a service worker, so the app does not open offline.

## Deploy

Static site. On Vercel: import the repository, set **Root Directory** to `apps/web`, and add the `VITE_API_URL` environment variable pointing to the deployed API. Vercel installs only the dependencies of that directory, so everything the build needs (TypeScript, Vitest for the type check of `test/`) is declared in this package's `package.json`.
