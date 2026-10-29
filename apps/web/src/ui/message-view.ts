import { createButton, type ButtonOptions } from "./button";
import { h } from "./dom";
import "./message-view.css";

export interface MessageViewOptions {
  title: string;
  text: string;
  actions: ButtonOptions[];
  /** Glyph inside the dashed circle. */
  symbol?: string;
}

/** A centered message with a way out: used for "not found", connection errors and camera problems. */
export function createMessageView({ title, text, actions, symbol = "?" }: MessageViewOptions): HTMLElement {
  return h(
    "section",
    { class: "message-view" },
    h(
      "div",
      { class: "message-view__body" },
      h("div", { class: "message-view__symbol", "aria-hidden": true }, symbol),
      h("h1", { class: "title title--small" }, title),
      h("p", { class: "muted" }, text),
    ),
    h("div", { class: "message-view__actions" }, ...actions.map(createButton)),
  );
}
