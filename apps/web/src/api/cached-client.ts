import type { HttpClient, QueryParams } from "./http-client";

const MAX_ENTRIES = 100;

/**
 * Remembers successful answers for a few minutes. The catalog changes once a day, so a product read
 * a moment ago is still right: switching between supermarket and wholesale prices, or going back to a
 * list, shows instantly instead of loading again. Failures are never remembered.
 */
export function withMemoryCache(
  http: HttpClient,
  ttlMs = 5 * 60_000,
  now: () => number = Date.now,
): HttpClient {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  const keyOf = (path: string, params: QueryParams) =>
    `${path}?${Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${value}`)
      .join("&")}`;

  return {
    async get<T>(path: string, params: QueryParams = {}): Promise<T> {
      const key = keyOf(path, params);
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value as T;

      const value = await http.get<T>(path, params);
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttlMs });
      if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
      return value;
    },
  };
}
