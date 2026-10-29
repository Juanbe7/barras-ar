import { looksLikeBarcode } from "../domain/barcode";

export type Route =
  { name: "home" } | { name: "scan" } | { name: "product"; ean: string } | { name: "search"; query: string };

export const paths = {
  home: "/",
  scan: "/scan",
  product: (ean: string) => `/product/${ean}`,
  search: (query: string) => `/search/${encodeURIComponent(query)}`,
};

function decode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** Reads a location hash such as "#/product/7790040147720"; anything unknown goes home. */
export function parseRoute(hash: string): Route {
  const [first, second] = hash.replace(/^#\/?/, "").split("/");
  const value = second === undefined ? null : decode(second);

  if (first === "scan") return { name: "scan" };
  if (first === "product" && value !== null && looksLikeBarcode(value))
    return { name: "product", ean: value };
  if (first === "search" && value) return { name: "search", query: value };
  return { name: "home" };
}

/** Where a typed query leads: a barcode opens the product, any other text opens the search. */
export function pathForQuery(text: string): string | null {
  const query = text.trim();
  if (query === "") return null;
  return looksLikeBarcode(query) ? paths.product(query) : paths.search(query);
}
