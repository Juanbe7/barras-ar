import type { Product, ReferencePrice } from "../api/types";

/** Where a price comes from: supermarkets or wholesalers. */
export type Channel = "retail" | "wholesale";

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: "retail", label: "Súper" },
  { id: "wholesale", label: "Mayorista" },
];

export const otherChannel = (channel: Channel): Channel => (channel === "retail" ? "wholesale" : "retail");

/** The price of a product in one channel, or null when nobody reported it there. */
export function priceFor(
  product: Pick<Product, "reference_price" | "wholesale_price">,
  channel: Channel,
): ReferencePrice | null {
  return (channel === "wholesale" ? product.wholesale_price : product.reference_price) ?? null;
}

/** What a whole box costs, from the price of one unit. */
export function boxPrice(unitPrice: number, units: number): number {
  return Math.round(unitPrice * units);
}
