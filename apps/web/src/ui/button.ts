import { h } from "./dom";
import "./button.css";

export interface ButtonOptions {
  label: string;
  /** Renders a link to this hash path; without it the button runs `onClick`. */
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "outline" | "quiet";
  large?: boolean;
  /** An icon shown before the label. */
  icon?: () => SVGElement;
}

export function createButton({
  label,
  href,
  onClick,
  variant = "primary",
  large,
  icon,
}: ButtonOptions): HTMLElement {
  const className = `button button--${variant}${large ? " button--large" : ""}`;
  const content = [icon?.(), label];
  if (href !== undefined) return h("a", { class: className, href: `#${href}` }, ...content);
  return h("button", { class: className, type: "button", onclick: () => onClick?.() }, ...content);
}
