import { describe, expect, it } from "vitest";
import app from "../src/index.js";

// The production entry point that Vercel serves. It must load without a database
// and answer the routes that do not need one.
describe("production entry point", () => {
  it("exports an app that answers without touching the database", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("BarrasAR");
  });

  it("answers JSON for unknown routes", async () => {
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });
});
