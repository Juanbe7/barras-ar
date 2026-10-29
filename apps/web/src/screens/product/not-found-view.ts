import type { Product } from "../../api/types";
import { describeRelated } from "../../domain/related";
import { paths } from "../../router/routes";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createProductRow } from "../../ui/product-row";
import "./not-found-view.css";

function createRelatedList(products: Product[]): HTMLElement {
  const { title, note } = describeRelated(products);
  return h(
    "section",
    { class: "not-found__related" },
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
}

/**
 * A code that is not in the catalog. It says so first, with the scanned number, and only afterwards,
 * under a heading that says it is something else, offers products with nearby codes. With none to
 * offer, the message and its buttons sit alone in the middle of the screen.
 */
export function createNotFoundView(ean: string, related: Product[]): HTMLElement {
  const alone = related.length === 0;

  return h(
    "section",
    { class: `not-found ${alone ? "not-found--alone" : ""}` },
    h(
      "header",
      { class: "not-found__header" },
      h("div", { class: "not-found__symbol", "aria-hidden": true }, "?"),
      h(
        "div",
        {},
        h("h1", { class: "title title--small" }, "No encontramos este código"),
        h("p", { class: "muted not-found__code" }, ean),
      ),
    ),
    h(
      "p",
      { class: "muted not-found__hint" },
      "Compará el número con el del envase. Si no coincide, escaneá de nuevo con buena luz.",
    ),
    h(
      "div",
      { class: "not-found__actions" },
      createButton({ label: "Escanear de nuevo", href: paths.scan }),
      createButton({ label: "Buscar por nombre", href: paths.home, variant: "quiet" }),
    ),
    !alone && createRelatedList(related),
  );
}
