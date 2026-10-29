import { EAN13_MODULES, encodeEan13 } from "../domain/ean13";
import { h } from "./dom";
import "./barcode.css";

const SVG_NS = "http://www.w3.org/2000/svg";
const QUIET_ZONE = 9; // empty modules on each side, as the standard asks
const BAR_HEIGHT = 46;
const GUARD_HEIGHT = 52; // the start, middle and end bars reach lower than the rest
const VIEW_WIDTH = EAN13_MODULES + QUIET_ZONE * 2;
const VIEW_HEIGHT = 62;

const GUARDS = [
  [0, 3],
  [45, 5],
  [92, 3],
] as const;
const isGuard = (module: number) =>
  GUARDS.some(([start, length]) => module >= start && module < start + length);

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

/** Groups the modules into runs of bars, so a barcode is a few dozen rectangles instead of 95. */
function barRuns(modules: string): { start: number; length: number; guard: boolean }[] {
  const runs: { start: number; length: number; guard: boolean }[] = [];
  for (let m = 0; m < modules.length; m++) {
    if (modules[m] !== "1") continue;
    const last = runs.at(-1);
    const guard = isGuard(m);
    if (last && last.start + last.length === m && last.guard === guard) last.length++;
    else runs.push({ start: m, length: 1, guard });
  }
  return runs;
}

function digitText(text: string, x: number, width: number): SVGElement {
  const element = svg("text", {
    x: String(x),
    y: "60",
    "text-anchor": "start",
    textLength: String(width),
    lengthAdjust: "spacing",
  });
  element.textContent = text;
  return element;
}

/** The real EAN-13 of a product, bars and digits, drawn with the current text color. */
export function createBarcode(ean: string): HTMLElement {
  const root = svg("svg", {
    viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
    role: "img",
    "aria-label": `Código de barras ${ean}`,
  });
  root.append(
    ...barRuns(encodeEan13(ean)).map(({ start, length, guard }) =>
      svg("rect", {
        x: String(QUIET_ZONE + start),
        y: "0",
        width: String(length),
        height: String(guard ? GUARD_HEIGHT : BAR_HEIGHT),
      }),
    ),
    digitText(ean.slice(0, 1), 1, 6),
    digitText(ean.slice(1, 7), QUIET_ZONE + 4, 38),
    digitText(ean.slice(7), QUIET_ZONE + 50, 38),
  );
  return h("div", { class: "barcode" }, root);
}
