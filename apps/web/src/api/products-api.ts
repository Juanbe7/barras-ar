import type { HttpClient } from "./http-client";
import type { ProductDetail, SearchPage } from "./types";

export const SEARCH_PAGE_SIZE = 20;

export interface ProductsApi {
  getByEan(ean: string): Promise<ProductDetail>;
  search(query: string, offset?: number, limit?: number): Promise<SearchPage>;
}

export function createProductsApi(http: HttpClient): ProductsApi {
  return {
    getByEan: (ean) => http.get<ProductDetail>(`/products/${ean}`),
    search: (query, offset = 0, limit = SEARCH_PAGE_SIZE) =>
      http.get<SearchPage>("/products", { q: query, limit, offset }),
  };
}
