import { h } from "./dom";
import "./loading.css";

const BARS = 7;

/** A barcode whose bars rise and fall, with a line saying what is being waited for. */
export function createLoading(text: string): HTMLElement {
  return h(
    "div",
    { class: "loading", role: "status" },
    h("div", { class: "loading__bars", "aria-hidden": true }, ...Array.from({ length: BARS }, () => h("i"))),
    h("p", { class: "loading__text" }, text),
  );
}
