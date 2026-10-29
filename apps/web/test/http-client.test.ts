import { describe, expect, it } from "vitest";
import { ApiError } from "../src/api/api-error";
import { createHttpClient } from "../src/api/http-client";

function clientReplying(response: Response | Error) {
  const requested: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    requested.push(String(input));
    if (response instanceof Error) throw response;
    return response;
  };
  return { client: createHttpClient("http://api.test", fetchFn), requested };
}

describe("http client", () => {
  it("builds the URL with its query parameters and parses the JSON", async () => {
    const { client, requested } = clientReplying(Response.json({ ok: true }));
    await expect(client.get("/products", { q: "yerba mate", limit: 20 })).resolves.toEqual({ ok: true });
    expect(requested).toEqual(["http://api.test/products?q=yerba+mate&limit=20"]);
  });

  it.each([
    [404, "not_found"],
    [400, "invalid"],
    [429, "rate_limited"],
    [500, "server"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const { client } = clientReplying(new Response("{}", { status }));
    await expect(client.get("/x")).rejects.toMatchObject({ kind });
  });

  it("reports a failed request as a network error", async () => {
    const { client } = clientReplying(new TypeError("Failed to fetch"));
    const error = await client.get("/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "network" });
  });
});
