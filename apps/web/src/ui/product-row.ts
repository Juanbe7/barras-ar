import { formatPrice } from "../domain/format";
import { paths } from "../router/routes";
import { h } from "./dom";
import "./product-row.css";

export interface ProductRowData {
  ean: string;
  title: string;
  detail?: string;
  price: number | null;
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
