import type { ProductDetail } from "../api/types";
import { formatAmount } from "../domain/format";
import { createBarcode } from "./barcode";
import { h } from "./dom";
import { createPriceRange } from "./price-range";
import "./price-tag.css";

/** The product as a shelf label: name, the typical price in large type, the price ruler and its barcode. */
export function createPriceTag(product: ProductDetail): HTMLElement {
  const { reference_price: price } = product;
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
          h("div", { class: "price-tag__label" }, "Precio típico"),
          h(
            "p",
            { class: "price-tag__amount" },
            h("span", { class: "price-tag__currency" }, "$"),
            formatAmount(price.median),
          ),
          createPriceRange(price),
        )
      : h("p", { class: "price-tag__empty" }, "Todavía no tiene precio de referencia."),
    createBarcode(product.ean),
  );
}
