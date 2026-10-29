const priceFormat = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const amountFormat = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** The number alone ("3.850"), for layouts that set the currency sign apart. */
export function formatAmount(amount: number): string {
  return amountFormat.format(amount);
}

export function formatPrice(amount: number): string {
  return priceFormat.format(amount);
}

/** "2026-10-29" -> "29/10/2026". Pure string work, so the time zone cannot shift the day. */
export function formatDate(isoDay: string): string {
  const [year, month, day] = isoDay.split("-");
  return `${day}/${month}/${year}`;
}

export function formatChains(count: number): string {
  return count === 1 ? "1 cadena" : `${count} cadenas`;
}
