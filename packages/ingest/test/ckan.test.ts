import { describe, expect, it } from "vitest";
import { isStale, pickLatestDailyResource } from "../src/source/ckan.js";

const BASE = "https://datos.produccion.gob.ar/dataset/x/resource/y/download";
const resource = (file: string, lastModified: string | null, size = 300_000_000) => ({
  name: file,
  url: `${BASE}/${file}`,
  size,
  last_modified: lastModified,
});

// shaped like the real package_show answer of 2026-10-29
const answer = (resources: unknown[]) => ({ success: true, result: { resources } });

describe("pickLatestDailyResource", () => {
  it("picks the most recently published daily ZIP, whatever its weekday", () => {
    const picked = pickLatestDailyResource(
      answer([
        resource("sepa_viernes.zip", "2026-10-23T16:19:23.384247"),
        resource("sepa_jueves.zip", "2026-10-29T16:19:52.178417", 324_924_535),
        resource("sepa_miercoles.zip", "2026-10-28T16:20:07.412585"),
      ]),
    );
    expect(picked.url).toBe(`${BASE}/sepa_jueves.zip`);
    expect(picked.size).toBe(324_924_535);
    expect(picked.lastModified.toISOString()).toBe("2026-10-29T16:19:52.178Z");
  });

  it("ignores the province translator and the metadata PDF", () => {
    const picked = pickLatestDailyResource(
      answer([
        resource("maestro-provincias.xlsx", "2026-12-01T10:00:00"),
        resource("anexo_6201340_2.pdf", "2026-12-01T10:00:00"),
        resource("sepa_lunes.zip", "2026-10-26T16:19:56.893606"),
      ]),
    );
    expect(picked.url).toContain("sepa_lunes.zip");
  });

  it("skips resources without a publication time", () => {
    const picked = pickLatestDailyResource(
      answer([resource("sepa_martes.zip", null), resource("sepa_lunes.zip", "2026-10-26T16:19:56")]),
    );
    expect(picked.url).toContain("sepa_lunes.zip");
  });

  it("fails clearly when there is no daily ZIP", () => {
    expect(() => pickLatestDailyResource(answer([]))).toThrow(/no daily ZIP/);
  });

  it("fails clearly on an unexpected answer", () => {
    expect(() => pickLatestDailyResource({ success: false })).toThrow(/Unexpected answer/);
    expect(() => pickLatestDailyResource(null)).toThrow(/Unexpected answer/);
  });
});

describe("isStale", () => {
  const latest = pickLatestDailyResource(answer([resource("sepa_jueves.zip", "2026-10-29T16:00:00")]));

  it("is fresh within the allowed age", () => {
    expect(isStale(latest, new Date("2026-10-31T16:00:00Z"), 3)).toBe(false);
  });

  it("is stale beyond it", () => {
    expect(isStale(latest, new Date("2026-11-02T16:00:00Z"), 3)).toBe(true);
  });
});
