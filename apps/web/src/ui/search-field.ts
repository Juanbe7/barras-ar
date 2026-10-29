import { h } from "./dom";
import "./search-field.css";

export interface SearchFieldOptions {
  value?: string;
  onSubmit: (text: string) => void;
}

/** A text box that submits on Enter / the keyboard's search key. */
export function createSearchField({ value = "", onSubmit }: SearchFieldOptions): HTMLElement {
  const input = h("input", {
    class: "search-field__input",
    type: "search",
    name: "q",
    value,
    placeholder: "Buscar por nombre o código",
    autocomplete: "off",
    enterkeyhint: "search",
    "aria-label": "Buscar por nombre o código",
  });
  return h(
    "form",
    {
      class: "search-field",
      onsubmit: (event) => {
        event.preventDefault();
        onSubmit(input.value);
      },
    },
    input,
  );
}
