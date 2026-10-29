import type { ProductDetail } from "../api/types";
import { priceFor, type Channel } from "../domain/channel";
import { formatAmount } from "../domain/format";
import { createBarcode } from "./barcode";
import { h } from "./dom";
import { createPriceRange } from "./price-range";
import "./price-tag.css";

/** What the label says where the price would be, when the channel being looked at has none. */
function emptyMessage(product: ProductDetail, channel: Channel): string {
  if (channel === "wholesale") return "Sin precio mayorista.";
  return product.wholesale_price
    ? "Sin precio de supermercado. Solo lo venden los mayoristas."
    : "Todavía no tiene precio de referencia.";
}

function priceLabel(product: ProductDetail, channel: Channel): string {
  if (product.pack) return "Precio por unidad";
  return channel === "wholesale" ? "Precio mayorista" : "Precio típico";
}

/** The product as a shelf label: name, the typical price in large type, the price ruler and its barcode. */
export function createPriceTag(product: ProductDetail, channel: Channel): HTMLElement {
  const price = priceFor(product, channel);
  const subtitle = [product.brand, product.category].filter(Boolean).join(" · ");

  return h(
    "article",
    { class: "price-tag" },
    h(
      "header",
      {},
      h("h1", { class: "price-tag__name" }, product.description),
      subtitle && h("p", { class: "price-tag__subtitle" }, subtitle),
    ),
    price
      ? h(
          "div",
          {},
          h("div", { class: "price-tag__label" }, priceLabel(product, channel)),
          h(
            "p",
            { class: "price-tag__amount" },
            h("span", { class: "price-tag__currency" }, "$"),
            formatAmount(price.median),
          ),
          createPriceRange(price),
        )
      : h("p", { class: "price-tag__empty" }, emptyMessage(product, channel)),
    createBarcode(product.ean),
  );
}
