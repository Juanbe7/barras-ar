import { createWriteStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { setTimeout as sleep } from "node:timers/promises";

/** Downloads `url` to `destination`, failing if the file ends up with a different size than the server announced. */
async function downloadOnce(url: string, destination: string): Promise<void> {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`Download failed: HTTP ${response.status}`);
  // fetch and node:stream/web declare the same stream with types that do not line up
  await pipeline(Readable.fromWeb(response.body as WebReadableStream), createWriteStream(destination));

  const announced = Number(response.headers.get("content-length") ?? 0);
  const received = statSync(destination).size;
  if (announced > 0 && received !== announced) {
    throw new Error(`Incomplete download: got ${received} bytes of ${announced}`);
  }
}

/** Downloads with a few retries; the portal and the network are not always steady. */
export async function downloadFile(url: string, destination: string, attempts = 3): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await downloadOnce(url, destination);
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.error(`${(err as Error).message}; retrying (${attempt}/${attempts - 1})`);
      await sleep(attempt * 2_000);
    }
  }
}
