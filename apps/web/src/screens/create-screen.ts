import type { AppContext } from "../app/context";
import type { Route } from "../router/routes";
import { createHomeScreen } from "./home/home-screen";
import { createProductScreen } from "./product/product-screen";
import { createScanScreen } from "./scan/scan-screen";
import { createSearchScreen } from "./search/search-screen";
import type { Screen } from "./screen";

export function createScreen(route: Route, ctx: AppContext): Screen {
  switch (route.name) {
    case "scan":
      return createScanScreen(ctx);
    case "product":
      return createProductScreen(ctx, route.ean);
    case "search":
      return createSearchScreen(ctx, route.query);
    case "home":
      return createHomeScreen(ctx);
  }
}
