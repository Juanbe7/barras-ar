import { createHttpClient } from "../api/http-client";
import { createProductsApi, type ProductsApi } from "../api/products-api";
import { config } from "../config";
import { navigate } from "../router/router";
import { createRecentProducts, type RecentProducts } from "../storage/recent-products";
import { createThemeStore, type ThemeStore } from "../storage/theme";

/** What every screen receives: the API, the on-device history and preferences, and navigation. */
export interface AppContext {
  products: ProductsApi;
  recents: RecentProducts;
  theme: ThemeStore;
  navigate: typeof navigate;
}

export function createContext(): AppContext {
  const theme = createThemeStore(
    window.localStorage,
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    (value) => {
      document.documentElement.dataset.theme = value;
    },
  );
  theme.applySaved();

  return {
    products: createProductsApi(createHttpClient(config.apiUrl)),
    recents: createRecentProducts(window.localStorage),
    theme,
    navigate,
  };
}
