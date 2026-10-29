import { paths } from "../router/routes";
import type { ThemeStore } from "../storage/theme";
import { h } from "./dom";
import { createBarcodeIcon } from "./icons";
import { createThemeToggle } from "./theme-toggle";
import "./app-header.css";

/** The bar shown on every screen: the app name (a link home) and the theme switch. */
export function createAppHeader(theme: ThemeStore): HTMLElement {
  const brand = h("a", { class: "app-header__brand", href: `#${paths.home}` }, "BarrasAR");
  brand.prepend(createBarcodeIcon());
  return h("header", { class: "app-header" }, brand, createThemeToggle(theme));
}
