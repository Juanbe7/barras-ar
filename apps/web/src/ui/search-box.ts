import type { ProductsApi } from "../api/products-api";
import { shouldSuggest } from "../domain/suggestions";
import { debounce } from "../util/debounce";
import { h } from "./dom";
import { createProductRow, toProductRowData } from "./product-row";
import { createSearchField } from "./search-field";
import "./search-box.css";

const SUGGESTION_COUNT = 5;
const SUGGEST_DELAY_MS = 350;

export interface SearchBox {
  element: HTMLElement;
  dispose: () => void;
}

export interface SearchBoxOptions {
  products: ProductsApi;
  onSubmit: (text: string) => void;
}

/** The search field plus a short list of matching products that updates while the person types. */
export function createSearchBox({ products, onSubmit }: SearchBoxOptions): SearchBox {
  const suggestions = h("div");
  // a thin bar that sweeps under the field from the first keystroke until the suggestions arrive
  const progress = h("div", { class: "search-box__progress", role: "progressbar", "aria-label": "Buscando" });
  // every keystroke takes a new ticket, so an answer that arrives late is recognized and dropped
  let latestTicket = 0;

  const setBusy = (busy: boolean) => progress.toggleAttribute("data-busy", busy);

  const fetchSuggestions = debounce(async (text: string, ticket: number) => {
    try {
      const page = await products.search(text.trim(), 0, SUGGESTION_COUNT);
      if (ticket !== latestTicket) return;
      suggestions.replaceChildren(...page.data.map((product) => createProductRow(toProductRowData(product))));
    } catch {
      // suggestions are a help, not a feature to report errors about: the search button still works
      if (ticket === latestTicket) suggestions.replaceChildren();
    } finally {
      if (ticket === latestTicket) setBusy(false);
    }
  }, SUGGEST_DELAY_MS);

  function stopSuggesting(): void {
    latestTicket++;
    fetchSuggestions.cancel();
    suggestions.replaceChildren();
    setBusy(false);
  }

  const field = createSearchField({
    onInput: (text) => {
      if (!shouldSuggest(text)) return stopSuggesting();
      setBusy(true);
      fetchSuggestions(text, ++latestTicket);
    },
    onSubmit: (text) => {
      stopSuggesting();
      onSubmit(text);
    },
  });

  return {
    element: h("div", { class: "search-box" }, field, progress, suggestions),
    dispose: stopSuggesting,
  };
}
