import { goBack } from "../router/router";
import { paths } from "../router/routes";
import { h } from "./dom";
import { createChevronLeftIcon } from "./icons";
import "./back-button.css";

export function createBackButton(label = "Volver"): HTMLElement {
  const button = h("button", {
    class: "back-button",
    type: "button",
    "aria-label": label,
    onclick: () => goBack(paths.home),
  });
  button.append(createChevronLeftIcon());
  return button;
}
