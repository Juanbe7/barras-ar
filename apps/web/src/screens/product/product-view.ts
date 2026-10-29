import type { ProductDetail } from "../../api/types";
import { formatChains, formatDate } from "../../domain/format";
import { paths } from "../../router/routes";
import { createBackButton } from "../../ui/back-button";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createScanIcon } from "../../ui/icons";
import { createPriceTag } from "../../ui/price-tag";
import "./product-view.css";

function fact(label: string, value: string): HTMLElement {
  return h("div", { class: "product-view__fact" }, h("span", {}, label), h("strong", {}, value));
}

/** The found product: its shelf label, where and when it was seen, and the data source credit. */
export function renderProductView(product: ProductDetail): HTMLElement {
  const { reference_price: price } = product;

  return h(
    "main",
    { class: "screen" },
    createBackButton(),
    createPriceTag(product),
    h(
      "div",
      {},
      fact("Visto en", formatChains(product.chains)),
      price && fact("Datos del", formatDate(price.date)),
    ),
    h("div", { class: "spacer" }),
    h(
      "p",
      { class: "muted product-view__source" },
      `Precio de referencia: puede variar según la sucursal. Fuente: ${product.source}`,
    ),
    createButton({ label: "Escanear otro", href: paths.scan, variant: "outline", icon: createScanIcon }),
  );
}
