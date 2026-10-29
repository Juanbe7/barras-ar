const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

/** A 24x24 outline icon that takes the current text color. */
function outlineIcon(...shapes: SVGElement[]): SVGElement {
  const svg = svgElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.4",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
  });
  svg.append(...shapes);
  return svg;
}

export const createSearchIcon = () =>
  outlineIcon(
    svgElement("circle", { cx: "10.5", cy: "10.5", r: "6.5" }),
    svgElement("path", { d: "M15.5 15.5 21 21" }),
  );

export const createChevronLeftIcon = () => outlineIcon(svgElement("path", { d: "M15 5 8 12l7 7" }));

export const createCloseIcon = () => outlineIcon(svgElement("path", { d: "M6 6l12 12M18 6 6 18" }));

/** A circle with one half filled: the usual sign of a light/dark switch. */
export const createThemeIcon = () =>
  outlineIcon(
    svgElement("circle", { cx: "12", cy: "12", r: "8" }),
    svgElement("path", { d: "M12 4a8 8 0 0 1 0 16z", fill: "currentColor" }),
  );

/** Four corner brackets around three bars: scanning. */
export const createScanIcon = () =>
  outlineIcon(
    svgElement("path", {
      d: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3",
    }),
    svgElement("path", { d: "M8 9v6M12 9v6M16 9v6" }),
  );

/** Barcode bars: the app's mark. */
export function createBarcodeIcon(): SVGElement {
  const svg = svgElement("svg", { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true" });
  const bars: [x: number, width: number][] = [
    [3, 2],
    [7, 1],
    [10, 3],
    [15, 1],
    [18, 3],
  ];
  svg.append(
    ...bars.map(([x, width]) =>
      svgElement("rect", { x: String(x), y: "4", width: String(width), height: "16" }),
    ),
  );
  return svg;
}

/** A lightning bolt: the flash. */
export const createFlashIcon = () =>
  outlineIcon(svgElement("path", { d: "M13 3 5 13.5h6L10 21l8-10.5h-6z" }));
