import { CHANNELS, type Channel } from "../domain/channel";
import type { ChannelStore } from "../storage/channel";
import { h } from "./dom";
import "./channel-switch.css";

/** The two-position switch that decides which prices the whole app shows: supermarket or wholesale. */
export function createChannelSwitch(store: ChannelStore): HTMLElement {
  const options = CHANNELS.map(({ id, label }) => ({
    id,
    button: h(
      "button",
      { class: "channel-switch__option", type: "button", role: "radio", onclick: () => store.set(id) },
      label,
    ),
  }));

  const sync = (current: Channel) =>
    options.forEach(({ id, button }) => button.setAttribute("aria-checked", String(id === current)));
  sync(store.current());
  store.subscribe(sync);

  return h(
    "div",
    { class: "channel-switch", role: "radiogroup", "aria-label": "Precios a mostrar" },
    ...options.map(({ button }) => button),
  );
}
