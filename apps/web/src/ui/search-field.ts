import { h } from "./dom";
import { createSearchIcon } from "./icons";
import "./search-field.css";

export interface SearchFieldOptions {
  value?: string;
  onSubmit: (text: string) => void;
  /** Called on every keystroke with the current text. */
  onInput?: (text: string) => void;
}

/** A rounded text box with a search button; it submits with the button or the keyboard's search key. */
export function createSearchField({ value = "", onSubmit, onInput }: SearchFieldOptions): HTMLFormElement {
  const input = h("input", {
    class: "search-field__input",
    type: "search",
    name: "q",
    value,
    placeholder: "Buscar por nombre o código",
    autocomplete: "off",
    enterkeyhint: "search",
    "aria-label": "Buscar por nombre o código",
    oninput: () => onInput?.(input.value),
  });
  const button = h("button", { class: "search-field__button", type: "submit", "aria-label": "Buscar" });
  button.append(createSearchIcon());

  return h(
    "form",
    {
      class: "search-field",
      onsubmit: (event) => {
        event.preventDefault();
        input.blur();
        onSubmit(input.value);
      },
    },
    input,
    button,
  );
}
