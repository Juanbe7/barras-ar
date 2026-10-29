import { ApiError } from "../../api/api-error";
import { paths } from "../../router/routes";
import { createApiErrorView } from "../../ui/api-error-view";
import { createBackButton } from "../../ui/back-button";
import { h } from "../../ui/dom";
import { createLoading } from "../../ui/loading";
import { createMessageView } from "../../ui/message-view";
import type { ScreenFactory } from "../screen";
import { renderProductView } from "./product-view";

function withBack(content: HTMLElement): HTMLElement {
  return h("main", { class: "screen" }, createBackButton(), content);
}

export const createProductScreen: ScreenFactory<[ean: string]> = (ctx, ean) => {
  const element = h("main", { class: "screen" });
  let disposed = false;

  function show(content: HTMLElement): void {
    if (!disposed) element.replaceWith(content);
  }

  async function load(): Promise<void> {
    element.replaceChildren(createBackButton(), createLoading("Buscando precios…"));
    try {
      const product = await ctx.products.getByEan(ean);
      ctx.recents.add({
        ean: product.ean,
        description: product.description,
        price: product.reference_price?.median ?? null,
      });
      show(renderProductView(product));
    } catch (error) {
      if (error instanceof ApiError && error.kind === "not_found") show(withBack(createNotFoundView(ean)));
      else show(withBack(createApiErrorView(error, () => void load())));
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

function createNotFoundView(ean: string): HTMLElement {
  return createMessageView({
    title: "No tenemos este código",
    text: `El ${ean} no figura en los datos de esta semana. Puede ser un producto nuevo o un código mal leído.`,
    actions: [
      { label: "Escanear de nuevo", href: paths.scan },
      { label: "Buscar por nombre", href: paths.home, variant: "quiet" },
    ],
  });
}
