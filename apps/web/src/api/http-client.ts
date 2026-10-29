import { ApiError, kindFromStatus } from "./api-error";

export type QueryParams = Record<string, string | number>;

export interface HttpClient {
  get<T>(path: string, params?: QueryParams): Promise<T>;
}

export function createHttpClient(
  baseUrl: string,
  fetchFn: typeof fetch = (input, init) => fetch(input, init),
): HttpClient {
  return {
    async get<T>(path: string, params: QueryParams = {}): Promise<T> {
      const url = new URL(path, baseUrl);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));

      let response: Response;
      try {
        response = await fetchFn(url);
      } catch {
        throw new ApiError("network", "No hay conexión con el servidor.");
      }
      if (!response.ok) throw new ApiError(kindFromStatus(response.status), `HTTP ${response.status}`);
      return (await response.json()) as T;
    },
  };
}
