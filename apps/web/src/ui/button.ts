import { h } from "./dom";
import "./button.css";

export interface ButtonOptions {
  label: string;
  /** Renders a link to this hash path; without it the button runs `onClick`. */
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "quiet";
  large?: boolean;
}

export function createButton({
  label,
  href,
  onClick,
  variant = "primary",
  large,
}: ButtonOptions): HTMLElement {
  const className = `button button--${variant}${large ? " button--large" : ""}`;
  if (href !== undefined) return h("a", { class: className, href: `#${href}` }, label);
  return h("button", { class: className, type: "button", onclick: () => onClick?.() }, label);
}
