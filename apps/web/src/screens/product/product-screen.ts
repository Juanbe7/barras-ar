import { ApiError } from "../../api/api-error";
import { createApiErrorView } from "../../ui/api-error-view";
import { createBackButton } from "../../ui/back-button";
import { h } from "../../ui/dom";
import { createLoading } from "../../ui/loading";
import { withTimeout } from "../../util/with-timeout";
import type { ScreenFactory } from "../screen";
import { createNotFoundView } from "./not-found-view";
import { renderProductView } from "./product-view";

const RELATED_WAIT_MS = 1500;

export const createProductScreen: ScreenFactory<[ean: string]> = (ctx, ean) => {
  // the container never changes, so the retry button can reload into it after an error
  const element = h("main", { class: "screen" });
  let disposed = false;

  function show(...content: Node[]): void {
    if (!disposed) element.replaceChildren(...content);
  }

  /**
   * The code is not in the catalog. Products with nearby codes are a bonus, so they are waited for only
   * briefly and, if they fail or are late, the plain message is shown; the layout is decided once.
   */
  async function showNotFound(): Promise<void> {
    show(createBackButton(), createLoading("Buscando productos parecidos…"));
    const related = await withTimeout(ctx.products.getRelated(ean), RELATED_WAIT_MS, []);
    show(createBackButton(), createNotFoundView(ean, related, ctx.channel.current()));
  }

  async function load(): Promise<void> {
    show(createBackButton(), createLoading("Buscando precios…"));
    try {
      const product = await ctx.products.getByEan(ean);
      ctx.recents.add({
        ean: product.ean,
        description: product.description,
        prices: {
          retail: product.reference_price?.median ?? null,
          wholesale: product.wholesale_price?.median ?? null,
        },
      });
      show(...renderProductView(product, ctx.channel.current(), (channel) => ctx.channel.set(channel)));
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not_found") void showNotFound();
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
