import type { SearchPage } from "../../api/types";
import { pathForQuery } from "../../router/routes";
import { createApiErrorView } from "../../ui/api-error-view";
import { createBackButton } from "../../ui/back-button";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createLoading } from "../../ui/loading";
import { createMessageView } from "../../ui/message-view";
import { createProductRow, toProductRowData } from "../../ui/product-row";
import { createSearchField } from "../../ui/search-field";
import type { ScreenFactory } from "../screen";
import "./search-screen.css";

export const createSearchScreen: ScreenFactory<[query: string]> = (ctx, query) => {
  const list = h("div");
  const footer = h("div");
  const header = h(
    "header",
    { class: "search-header" },
    createBackButton(),
    createSearchField({
      value: query,
      onSubmit: (text) => {
        const path = pathForQuery(text);
        if (path) ctx.navigate(path, { replace: true });
      },
    }),
  );
  const element = h(
    "main",
    { class: "screen screen--bare" },
    header,
    h("div", { class: "search-content" }, list, footer),
  );

  let disposed = false;
  let loaded = 0;

  function footerFor(page: SearchPage): HTMLElement | null {
    if (loaded === 0) {
      return createMessageView({
        title: "Sin resultados",
        text: `No encontramos productos para "${query}". Probá con otras palabras.`,
        actions: [],
      });
    }
    return page.has_more
      ? createButton({ label: "Ver más", variant: "quiet", onClick: () => void loadPage() })
      : null;
  }

  async function loadPage(): Promise<void> {
    footer.replaceChildren(createLoading("Buscando…"));
    try {
      const page = await ctx.products.search(query, loaded);
      if (disposed) return;
      loaded += page.data.length;
      list.append(...page.data.map((product) => createProductRow(toProductRowData(product))));
      footer.replaceChildren(...[footerFor(page)].filter((node) => node !== null));
    } catch (error) {
      if (!disposed) footer.replaceChildren(createApiErrorView(error, () => void loadPage()));
    }
  }
  void loadPage();

  return {
    element,
    dispose: () => {
      disposed = true;
    },
  };
};
