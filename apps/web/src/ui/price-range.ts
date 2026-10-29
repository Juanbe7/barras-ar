import type { ReferencePrice } from "../api/types";
import { formatPrice } from "../domain/format";
import { positionInRange } from "../domain/price-position";
import { h } from "./dom";
import "./price-range.css";

/** The typical (median) price in large type, over a line that shows where it falls between min and max. */
export function createPriceRange({ median, min, max }: ReferencePrice): HTMLElement {
  const position = positionInRange(median, min, max) * 100;
  return h(
    "div",
    { class: "price-range" },
    h("div", { class: "label" }, "Precio típico"),
    h("p", { class: "price-range__median" }, formatPrice(median)),
    h(
      "div",
      { class: "price-range__track", "aria-hidden": true },
      h("i", { class: "price-range__end", style: "left: 0" }),
      h("i", { class: "price-range__median-dot", style: `left: ${position}%` }),
      h("i", { class: "price-range__end", style: "left: 100%" }),
    ),
    h(
      "div",
      { class: "price-range__limits" },
      h("span", {}, formatPrice(min), h("small", {}, "mínimo")),
      h("span", {}, formatPrice(max), h("small", {}, "máximo")),
    ),
  );
}
