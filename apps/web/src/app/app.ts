import { startRouter } from "../router/router";
import { createScreen } from "../screens/create-screen";
import type { Screen } from "../screens/screen";
import { createAppHeader } from "../ui/app-header";
import { h } from "../ui/dom";
import { createContext } from "./context";

/**
 * Draws the fixed header once and shows the screen of the current route below it, disposing the
 * previous screen on every change (e.g. to release the camera).
 */
export function startApp(root: HTMLElement): void {
  const ctx = createContext();
  const outlet = h("div", { class: "app__outlet" });
  root.replaceChildren(createAppHeader(ctx.theme), outlet);

  let current: Screen | null = null;
  startRouter((route) => {
    current?.dispose?.();
    current = createScreen(route, ctx);
    outlet.replaceChildren(current.element);
    window.scrollTo(0, 0);
  });
}
