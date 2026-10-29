import { goBack } from "../router/router";
import { paths } from "../router/routes";
import { h } from "./dom";
import "./back-button.css";

export function createBackButton(label = "Volver"): HTMLElement {
  return h(
    "button",
    { class: "back-button", type: "button", "aria-label": label, onclick: () => goBack(paths.home) },
    "‹",
  );
}
