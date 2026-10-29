import { ApiError } from "../../api/api-error";
import { createApiErrorView } from "../../ui/api-error-view";
import { createBackButton } from "../../ui/back-button";
import { h } from "../../ui/dom";
import { createLoading } from "../../ui/loading";
import type { ScreenFactory } from "../screen";
import { createNotFoundView } from "./not-found-view";
import { renderProductView } from "./product-view";

export const createProductScreen: ScreenFactory<[ean: string]> = (ctx, ean) => {
  // the container never changes, so the retry button can reload into it after an error
  const element = h("main", { class: "screen" });
  let disposed = false;

  function show(...content: Node[]): void {
    if (!disposed) element.replaceChildren(...content);
  }

  /** The code is not in the catalog: say so now, and add products with nearby codes if the API has any. */
  function showNotFound(): void {
    const view = createNotFoundView(ean);
    show(createBackButton(), ...view.nodes);
    // the list is a bonus: if it fails or is empty the plain "not found" stays as it is
    ctx.products
      .getRelated(ean)
      .then((related) => {
        if (!disposed) view.showRelated(related);
      })
      .catch(() => {});
  }

  async function load(): Promise<void> {
    show(createBackButton(), createLoading("Buscando precios…"));
    try {
      const product = await ctx.products.getByEan(ean);
      ctx.recents.add({
        ean: product.ean,
        description: product.description,
        price: product.reference_price?.median ?? null,
      });
      show(...renderProductView(product));
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not_found") showNotFound();
      else
        show(
          createBackButton(),
          createApiErrorView(error, () => void load()),
        );
    }
  }
  void load();

  return {
    element,
    dispose: () => {
      disposed = true;
    },
  };
};
