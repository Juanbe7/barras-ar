import type { Product } from "../api/types";
import { priceFor, type Channel } from "../domain/channel";
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

/** The small line under a name: where the price comes from, or why there is none in this channel. */
function detailFor(product: Product, channel: Channel): string | undefined {
  if (channel === "wholesale") return product.brand ?? undefined;
  if (product.reference_price) return formatChains(product.chains);
  return product.wholesale_price ? "Solo mayoristas" : undefined;
}

/** The row of a product coming from the API, with the typical price of the channel being looked at. */
export function toProductRowData(product: Product, channel: Channel): ProductRowData {
  return {
    ean: product.ean,
    title: product.description,
    detail: detailFor(product, channel),
    price: priceFor(product, channel)?.median ?? null,
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
