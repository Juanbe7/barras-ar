import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { downloadFile } from "../src/source/download.js";

const BODY = Buffer.from("zip bytes ".repeat(1000));

let server: Server;
let base: string;
let hits = 0;
const folder = mkdtempSync(join(tmpdir(), "download-test-"));

beforeAll(async () => {
  server = createServer((req, res) => {
    hits++;
    if (req.url === "/ok") {
      res.writeHead(200, { "content-length": BODY.length }).end(BODY);
    } else if (req.url === "/redirect") {
      res.writeHead(302, { location: "/ok" }).end();
    } else if (req.url === "/flaky" && hits % 2 === 1) {
      res.writeHead(503).end();
    } else if (req.url === "/flaky") {
      res.writeHead(200, { "content-length": BODY.length }).end(BODY);
    } else if (req.url === "/short") {
      // announces more bytes than it sends, like a dropped connection
      res.writeHead(200, { "content-length": BODY.length + 500 });
      res.write(BODY);
      res.destroy();
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  hits = 0;
  vi.restoreAllMocks();
});

afterAll(() => {
  server.close();
  rmSync(folder, { recursive: true, force: true });
});

describe("downloadFile", () => {
  it("saves the file and follows redirects", async () => {
    const target = join(folder, "a.zip");
    await downloadFile(`${base}/redirect`, target);
    expect(readFileSync(target).equals(BODY)).toBe(true);
  });

  it("retries after a server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const target = join(folder, "b.zip");
    await downloadFile(`${base}/flaky`, target);
    expect(readFileSync(target).equals(BODY)).toBe(true);
    expect(hits).toBe(2);
  });

  it("gives up after the allowed attempts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(downloadFile(`${base}/missing`, join(folder, "c.zip"), 2)).rejects.toThrow(/404/);
    expect(hits).toBe(2);
  });

  it("rejects a download that ends early", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(downloadFile(`${base}/short`, join(folder, "d.zip"), 1)).rejects.toThrow();
  });
});
