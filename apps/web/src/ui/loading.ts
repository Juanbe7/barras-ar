import { h } from "./dom";

export function createLoading(text: string): HTMLElement {
  return h("p", { class: "muted", role: "status" }, text);
}
