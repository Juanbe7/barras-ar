import { pathForQuery, paths } from "../../router/routes";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createProductRow } from "../../ui/product-row";
import { createSearchField } from "../../ui/search-field";
import { createThemeToggle } from "../../ui/theme-toggle";
import type { ScreenFactory } from "../screen";
import "./home-screen.css";

export const createHomeScreen: ScreenFactory = (ctx) => {
  const recents = ctx.recents.list();

  const element = h(
    "main",
    { class: "screen" },
    h(
      "header",
      { class: "home__header" },
      h(
        "div",
        {},
        h("h1", { class: "title" }, "¿Cuánto sale?"),
        h("p", { class: "muted" }, "Escaneá un código o buscá por nombre."),
      ),
      createThemeToggle(ctx.theme),
    ),
    createButton({ label: "Escanear código", href: paths.scan, large: true }),
    createSearchField({
      onSubmit: (text) => {
        const path = pathForQuery(text);
        if (path) ctx.navigate(path);
      },
    }),
    h("div", { class: "spacer" }),
    recents.length > 0 &&
      h(
        "section",
        {},
        h("div", { class: "label" }, "Vistos hace poco"),
        ...recents.map(({ ean, description, price }) => createProductRow({ ean, title: description, price })),
      ),
  );

  return { element };
};
