import type { Pack, ProductDetail } from "../../api/types";
import { boxPrice, otherChannel, priceFor, type Channel } from "../../domain/channel";
import { formatChains, formatDate, formatPrice } from "../../domain/format";
import { paths } from "../../router/routes";
import { createBackButton } from "../../ui/back-button";
import { createButton } from "../../ui/button";
import { h } from "../../ui/dom";
import { createScanIcon } from "../../ui/icons";
import { createPriceTag } from "../../ui/price-tag";
import "./product-view.css";

const WHOLESALE_NOTE =
  "Costo aproximado para comprar y revender, con IVA. No es un precio sugerido: en algunos productos supera al del supermercado.";

const SWITCH_LABELS: Record<Channel, string> = {
  retail: "Ver precio de supermercado",
  wholesale: "Ver precio mayorista",
};

function fact(label: string, value: string): HTMLElement {
  return h("div", { class: "product-view__fact" }, h("span", {}, label), h("strong", {}, value));
}

/** Shown when the code that was asked for is a wholesale box: what the box holds. */
function createPackNotice({ code, units }: Pack): HTMLElement {
  return h(
    "div",
    { class: "product-view__pack" },
    h("strong", {}, `Caja de ${units} ${units === 1 ? "unidad" : "unidades"}`),
    h("span", {}, `Código de la caja ${code}`),
  );
}

/** The content of the found product screen: its shelf label for the channel in use, the facts and the credit. */
export function renderProductView(
  product: ProductDetail,
  channel: Channel,
  onChannelChange: (channel: Channel) => void,
): Node[] {
  const price = priceFor(product, channel);
  const other = otherChannel(channel);
  const content: (Node | false | null | undefined)[] = [
    createBackButton(),
    product.pack && createPackNotice(product.pack),
    createPriceTag(product, channel),
    // no price here but one in the other channel: a way to get there without hunting for the switch
    !price &&
      priceFor(product, other) &&
      createButton({
        label: SWITCH_LABELS[other],
        variant: "outline",
        onClick: () => onChannelChange(other),
      }),
    price && channel === "wholesale" && h("p", { class: "muted product-view__note" }, WHOLESALE_NOTE),
    h(
      "div",
      {},
      // `chains` counts supermarket chains
      channel === "retail" && product.reference_price && fact("Visto en", formatChains(product.chains)),
      product.pack &&
        price &&
        fact("Precio por caja", formatPrice(boxPrice(price.median, product.pack.units))),
      price && fact("Datos del", formatDate(price.date)),
    ),
    h("div", { class: "spacer" }),
    h(
      "p",
      { class: "muted product-view__source" },
      `Precios de referencia: pueden variar según la sucursal. Fuente: ${product.source}`,
    ),
    createButton({ label: "Escanear otro", href: paths.scan, variant: "outline", icon: createScanIcon }),
  ];
  return content.filter((node): node is Node => Boolean(node));
}
