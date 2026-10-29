const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

/** A magnifying glass drawn with the current text color. */
export function createSearchIcon(): SVGElement {
  const svg = svgElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.4",
    "stroke-linecap": "round",
    "aria-hidden": "true",
  });
  svg.append(
    svgElement("circle", { cx: "10.5", cy: "10.5", r: "6.5" }),
    svgElement("path", { d: "M15.5 15.5 21 21" }),
  );
  return svg;
}
