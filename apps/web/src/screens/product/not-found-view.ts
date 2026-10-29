import type { Product } from "../../api/types";
import { describeRelated } from "../../domain/related";
import { paths } from "../../router/routes";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createProductRow } from "../../ui/product-row";
import "./not-found-view.css";

export interface NotFoundView {
  nodes: HTMLElement[];
  /** Adds the list of related products below the actions; an empty list adds nothing. */
  showRelated(products: Product[]): void;
}

/**
 * A code that is not in the catalog. It says so first, with the scanned number, and only afterwards,
 * under a heading that says it is something else, offers products with nearby codes.
 */
export function createNotFoundView(ean: string): NotFoundView {
  const related = h("section", { class: "not-found__related" });
  related.hidden = true;

  const header = h(
    "header",
    { class: "not-found__header" },
    h("div", { class: "not-found__symbol", "aria-hidden": true }, "?"),
    h(
      "div",
      {},
      h("h1", { class: "title title--small" }, "No encontramos este código"),
      h("p", { class: "muted not-found__code" }, ean),
    ),
  );
  const actions = h(
    "div",
    { class: "not-found__actions" },
    createButton({ label: "Escanear de nuevo", href: paths.scan }),
    createButton({ label: "Buscar por nombre", href: paths.home, variant: "quiet" }),
  );

  return {
    nodes: [header, actions, related],
    showRelated(products) {
      if (products.length === 0) return;
      const { title, note } = describeRelated(products);
      related.replaceChildren(
        h("h2", { class: "not-found__heading" }, title),
        h("p", { class: "muted" }, note),
        h(
          "div",
          { class: "not-found__list" },
          ...products.map((product) =>
            createProductRow({
              ean: product.ean,
              title: product.description,
              detail: product.brand ?? undefined,
              price: product.reference_price?.median ?? null,
            }),
          ),
        ),
      );
      related.hidden = false;
    },
  };
}
