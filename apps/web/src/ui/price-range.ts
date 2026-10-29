import type { ReferencePrice } from "../api/types";
import { formatPrice } from "../domain/format";
import { positionInRange } from "../domain/price-position";
import { h } from "./dom";
import "./price-range.css";

function limit(kind: "min" | "max", label: string, amount: number): HTMLElement {
  return h(
    "span",
    { class: `price-range__limit price-range__limit--${kind}` },
    h("small", {}, label),
    formatPrice(amount),
  );
}

/** A ruler from the cheapest to the dearest price, with a marker where the typical price falls. */
export function createPriceRange({ median, min, max }: ReferencePrice): HTMLElement {
  const position = positionInRange(median, min, max) * 100;
  return h(
    "div",
    { class: "price-range" },
    h(
      "div",
      { class: "price-range__track", "aria-hidden": true },
      h("i", { class: "price-range__marker", style: `--position: ${position}%` }),
    ),
    h("div", { class: "price-range__limits" }, limit("min", "Mínimo", min), limit("max", "Máximo", max)),
  );
}
