import type { HttpClient } from "./http-client";
import type { Product, ProductDetail, RelatedResponse, SearchPage } from "./types";

export const SEARCH_PAGE_SIZE = 20;

export interface ProductsApi {
  getByEan(ean: string): Promise<ProductDetail>;
  search(query: string, offset?: number, limit?: number): Promise<SearchPage>;
  /** Products with nearby codes (same manufacturer); works for codes that are not in the catalog. */
  getRelated(ean: string): Promise<Product[]>;
}

export function createProductsApi(http: HttpClient): ProductsApi {
  return {
    getByEan: (ean) => http.get<ProductDetail>(`/products/${ean}`),
    search: (query, offset = 0, limit = SEARCH_PAGE_SIZE) =>
      http.get<SearchPage>("/products", { q: query, limit, offset }),
    getRelated: async (ean) => (await http.get<RelatedResponse>(`/products/${ean}/related`)).data,
  };
}
