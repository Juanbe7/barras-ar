/** The SEPA dataset on the open data portal (a CKAN site). */
export const SEPA_PACKAGE_URL = "https://datos.produccion.gob.ar/api/3/action/package_show?id=sepa-precios";

export interface DailyResource {
  name: string;
  url: string;
  size: number;
  lastModified: Date;
}

interface CkanResource {
  name?: string;
  url?: string;
  size?: number | string | null;
  last_modified?: string | null;
}

// the dataset has one ZIP per weekday (sepa_lunes.zip ... sepa_domingo.zip), replaced every week
const DAILY_ZIP = /\/sepa_(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\.zip$/;

/**
 * The daily ZIP published most recently, from the portal's `package_show` answer.
 * It goes by publication time and not by weekday name, so it needs no calendar logic.
 */
export function pickLatestDailyResource(packageShow: unknown): DailyResource {
  const answer = packageShow as { success?: boolean; result?: { resources?: CkanResource[] } } | null;
  if (!answer?.success || !Array.isArray(answer.result?.resources)) {
    throw new Error("Unexpected answer from the SEPA portal (package_show)");
  }
  const daily: DailyResource[] = [];
  for (const resource of answer.result.resources) {
    if (!resource.url || !DAILY_ZIP.test(resource.url) || !resource.last_modified) continue;
    // timestamps come without a zone; only their order and rough age matter here
    const lastModified = new Date(`${resource.last_modified}Z`);
    if (Number.isNaN(lastModified.getTime())) continue;
    daily.push({
      name: resource.name ?? resource.url,
      url: resource.url,
      size: Number(resource.size ?? 0),
      lastModified,
    });
  }
  const latest = daily.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())[0];
  if (!latest) throw new Error("The SEPA portal lists no daily ZIP");
  return latest;
}

/** True if the resource is older than `maxAgeDays`: the source stopped publishing. */
export function isStale(resource: DailyResource, now: Date, maxAgeDays: number): boolean {
  return now.getTime() - resource.lastModified.getTime() > maxAgeDays * 24 * 60 * 60 * 1000;
}

export async function fetchLatestDailyResource(): Promise<DailyResource> {
  const response = await fetch(SEPA_PACKAGE_URL, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`The SEPA portal answered ${response.status}`);
  return pickLatestDailyResource(await response.json());
}
