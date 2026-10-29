import { startRouter } from "../router/router";
import { createScreen } from "../screens/create-screen";
import type { Screen } from "../screens/screen";
import { createContext } from "./context";

/** Shows the screen of the current route and disposes the previous one (e.g. to release the camera). */
export function startApp(root: HTMLElement): void {
  const ctx = createContext();
  let current: Screen | null = null;

  startRouter((route) => {
    current?.dispose?.();
    current = createScreen(route, ctx);
    root.replaceChildren(current.element);
    window.scrollTo(0, 0);
  });
}
