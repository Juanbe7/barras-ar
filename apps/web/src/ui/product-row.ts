import type { Product } from "../api/types";
import { formatChains, formatPrice } from "../domain/format";
import { paths } from "../router/routes";
import { h } from "./dom";
import "./product-row.css";

export interface ProductRowData {
  ean: string;
  title: string;
  detail?: string;
  price: number | null;
}

/** The row of a product coming from the API: its name, in how many chains it is sold and its typical price. */
export function toProductRowData(product: Product): ProductRowData {
  return {
    ean: product.ean,
    title: product.description,
    detail: formatChains(product.chains),
    price: product.reference_price?.median ?? null,
  };
}

/** One line of a product list: name, a small detail and the typical price; the whole row is a link. */
export function createProductRow({ ean, title, detail, price }: ProductRowData): HTMLElement {
  return h(
    "a",
    { class: "product-row", href: `#${paths.product(ean)}` },
    h("span", { class: "product-row__name" }, title, detail && h("small", {}, detail)),
    h("span", { class: "product-row__price" }, price === null ? "—" : formatPrice(price)),
  );
}
