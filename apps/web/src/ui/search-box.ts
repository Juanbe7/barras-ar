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
  // every keystroke takes a new ticket, so an answer that arrives late is recognized and dropped
  let latestTicket = 0;

  const fetchSuggestions = debounce(async (text: string, ticket: number) => {
    try {
      const page = await products.search(text.trim(), 0, SUGGESTION_COUNT);
      if (ticket === latestTicket) {
        suggestions.replaceChildren(
          ...page.data.map((product) => createProductRow(toProductRowData(product))),
        );
      }
    } catch {
      // suggestions are a help, not a feature to report errors about: the search button still works
      if (ticket === latestTicket) suggestions.replaceChildren();
    }
  }, SUGGEST_DELAY_MS);

  function stopSuggesting(): void {
    latestTicket++;
    fetchSuggestions.cancel();
    suggestions.replaceChildren();
  }

  const field = createSearchField({
    onInput: (text) => {
      if (!shouldSuggest(text)) return stopSuggesting();
      fetchSuggestions(text, ++latestTicket);
    },
    onSubmit: (text) => {
      stopSuggesting();
      onSubmit(text);
    },
  });

  return { element: h("div", { class: "search-box" }, field, suggestions), dispose: stopSuggesting };
}
