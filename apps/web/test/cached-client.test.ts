import { describe, expect, it, vi } from "vitest";
import { withMemoryCache } from "../src/api/cached-client";
import type { HttpClient } from "../src/api/http-client";

function setup(ttlMs = 1000) {
  let time = 0;
  const get = vi.fn(async (path: string) => ({ path }));
  const client = withMemoryCache({ get } as unknown as HttpClient, ttlMs, () => time);
  return { client, get, advance: (ms: number) => (time += ms) };
}

describe("withMemoryCache", () => {
  it("answers a repeated request without asking again", async () => {
    const { client, get } = setup();
    await client.get("/products/1");
    await client.get("/products/1");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("tells requests apart by path and parameters, whatever their order", async () => {
    const { client, get } = setup();
    await client.get("/products", { q: "a", limit: 5 });
    await client.get("/products", { limit: 5, q: "a" });
    await client.get("/products", { q: "b", limit: 5 });
    await client.get("/products/1");
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("asks again once the answer is too old", async () => {
    const { client, get, advance } = setup(1000);
    await client.get("/products/1");
    advance(1001);
    await client.get("/products/1");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does not remember a failure", async () => {
    const get = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue({ ok: true });
    const client = withMemoryCache({ get } as unknown as HttpClient);
    await expect(client.get("/x")).rejects.toThrow();
    await expect(client.get("/x")).resolves.toEqual({ ok: true });
    expect(get).toHaveBeenCalledTimes(2);
  });
});
