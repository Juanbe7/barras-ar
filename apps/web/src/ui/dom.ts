export type Child = Node | string | null | false | undefined;
type PropValue = string | number | boolean | undefined | ((event: Event) => void);
export type Props = Record<string, PropValue>;

/**
 * Builds an element: `class` sets the class name, `onclick`-style props add listeners,
 * `true` sets a boolean attribute and `false`/`undefined` skip the prop.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (typeof value === "function") element.addEventListener(key.slice(2), value);
    else if (key === "class") element.className = String(value);
    else element.setAttribute(key, value === true ? "" : String(value));
  }
  element.append(...children.filter((child): child is Node | string => child != null && child !== false));
  return element;
}
