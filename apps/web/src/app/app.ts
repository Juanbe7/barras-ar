import { startRouter } from "../router/router";
import type { Route } from "../router/routes";
import { createScreen } from "../screens/create-screen";
import type { Screen } from "../screens/screen";
import { createAppHeader } from "../ui/app-header";
import { h } from "../ui/dom";
import { createContext } from "./context";

/**
 * Draws the fixed header once and shows the screen of the current route below it, disposing the
 * previous screen on every change (e.g. to release the camera). Switching between supermarket and
 * wholesale prices draws the same screen again, in place.
 */
export function startApp(root: HTMLElement): void {
  const ctx = createContext();
  const outlet = h("div", { class: "app__outlet" });
  root.replaceChildren(createAppHeader(ctx.theme, ctx.channel), outlet);

  let route: Route | null = null;
  let current: Screen | null = null;

  function show(next: Route): void {
    current?.dispose?.();
    current = createScreen(next, ctx);
    outlet.replaceChildren(current.element);
  }

  startRouter((next) => {
    route = next;
    show(next);
    window.scrollTo(0, 0);
  });

  // the scanner has no prices on it: redrawing it would only restart the camera
  ctx.channel.subscribe(() => {
    if (route && route.name !== "scan") show(route);
  });
}
