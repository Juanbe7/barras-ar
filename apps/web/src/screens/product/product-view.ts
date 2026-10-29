import type { ProductDetail } from "../../api/types";
import { formatChains, formatDate } from "../../domain/format";
import { paths } from "../../router/routes";
import { createBackButton } from "../../ui/back-button";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createPriceRange } from "../../ui/price-range";
import "./product-view.css";

function fact(label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "product-view__fact" },
    h("span", {}, label),
    h("span", { class: "product-view__value" }, value),
  );
}

/** The found product: name, price range, where and when it was seen, and the data source credit. */
export function renderProductView(product: ProductDetail): HTMLElement {
  const { reference_price: price } = product;
  const subtitle = [product.brand, product.category].filter(Boolean).join(" · ");

  return h(
    "main",
    { class: "screen" },
    createBackButton(),
    h(
      "header",
      {},
      h("h1", { class: "title title--small" }, product.description),
      subtitle && h("p", { class: "muted" }, subtitle),
      h("p", { class: "muted product-view__ean" }, product.ean),
    ),
    price
      ? createPriceRange(price)
      : h("p", { class: "muted" }, "Este producto todavía no tiene precio de referencia."),
    h(
      "div",
      {},
      fact("Visto en", formatChains(product.chains)),
      price && fact("Actualizado", formatDate(price.date)),
    ),
    h("div", { class: "spacer" }),
    h(
      "p",
      { class: "muted product-view__source" },
      `Precio de referencia: puede variar según la sucursal. Fuente: ${product.source}`,
    ),
    createButton({ label: "Escanear otro", href: paths.scan }),
  );
}
