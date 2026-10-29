import type { Theme, ThemeStore } from "../storage/theme";
import { h } from "./dom";
import "./theme-toggle.css";

const LABELS: Record<Theme, string> = {
  light: "Cambiar a tema oscuro",
  dark: "Cambiar a tema claro",
};

/** A small button that switches between the light and dark theme. */
export function createThemeToggle(theme: ThemeStore): HTMLElement {
  const button = h("button", { class: "theme-toggle", type: "button" }, "◐");
  const sync = (current: Theme) => button.setAttribute("aria-label", LABELS[current]);

  sync(theme.current());
  button.addEventListener("click", () => sync(theme.toggle()));
  return button;
}
