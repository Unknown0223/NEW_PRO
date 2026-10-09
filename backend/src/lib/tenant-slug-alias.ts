import { env } from "../config/env";

let cachedRaw: string | undefined;
let cachedMap = new Map<string, string>();

function aliasMap(): Map<string, string> {
  const raw = env.TENANT_SLUG_ALIASES ?? "";
  if (raw === cachedRaw) return cachedMap;
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [from, to] = pair.split(":").map((s) => s?.trim().toLowerCase() ?? "");
    if (from && to && from !== to) map.set(from, to);
  }
  cachedRaw = raw;
  cachedMap = map;
  return map;
}

/** Eski slug bo‘lsa — yangi slug; aks holda o‘zi. */
export function resolveTenantSlugAlias(slug: string): string {
  const s = slug.trim();
  return aliasMap().get(s.toLowerCase()) ?? s;
}
