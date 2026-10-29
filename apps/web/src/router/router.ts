import { parseRoute, type Route } from "./routes";

export function startRouter(onRoute: (route: Route) => void): void {
  const handle = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener("hashchange", handle);
  handle();
}

export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (options.replace) window.location.replace(`#${path}`);
  else window.location.hash = path;
}

/** Goes back in history, or home when the app was opened directly on an inner screen. */
export function goBack(homePath: string): void {
  if (window.history.length > 1) window.history.back();
  else navigate(homePath, { replace: true });
}
