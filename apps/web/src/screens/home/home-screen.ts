import { pathForQuery, paths } from "../../router/routes";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createProductRow } from "../../ui/product-row";
import { createSearchBox } from "../../ui/search-box";
import type { ScreenFactory } from "../screen";

export const createHomeScreen: ScreenFactory = (ctx) => {
  const recents = ctx.recents.list();
  const searchBox = createSearchBox({
    products: ctx.products,
    onSubmit: (text) => {
      const path = pathForQuery(text);
      if (path) ctx.navigate(path);
    },
  });

  const element = h(
    "main",
    { class: "screen" },
    h(
      "header",
      {},
      h("h1", { class: "title" }, "¿Cuánto sale?"),
      h("p", { class: "muted" }, "Escaneá un código o buscá por nombre."),
    ),
    createButton({ label: "Escanear código", href: paths.scan, large: true }),
    searchBox.element,
    h("div", { class: "spacer" }),
    recents.length > 0 &&
      h(
        "section",
        {},
        h("div", { class: "label" }, "Vistos hace poco"),
        ...recents.map(({ ean, description, price }) => createProductRow({ ean, title: description, price })),
      ),
  );

  return { element, dispose: searchBox.dispose };
};
