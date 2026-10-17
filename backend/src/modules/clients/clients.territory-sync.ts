import { prisma } from "../../config/database";
import {
  lalakuExpandRegionFilterTokens,
  normKeyTerritoryMatch
} from "../../../shared/territory-lalaku-seed";
import {
  buildCityTerritoryHints,
  territoryRegionPickerNames,
  territoryRegionStoredPairs,
  type CityTerritoryHintDto
} from "../tenant-settings/tenant-settings.territory";
import { stringArrayFromUnknown } from "../tenant-settings/tenant-settings.refs";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { referencesWithResolvedTerritoryNodes } from "../tenant-settings/tenant-settings.service";

/** «SAMARQAND» ↔ «SAMARQAND VILOYATI», «QOQON» ↔ «QOQON SHAXAR»: tarixiy qisqa nomlar ham to‘g‘ri. */
function leadToken(v: string): string {
  const first = v.trim().split(/[\s_\-]+/)[0] ?? "";
  const k = normKeyTerritoryMatch(first);
  return k.length >= 4 ? k : "";
}

function knownRegionKeys(
  refs: Record<string, unknown> | undefined,
  hints: Record<string, CityTerritoryHintDto>
): { full: Set<string>; lead: Set<string> } {
  const full = new Set<string>();
  const lead = new Set<string>();
  const add = (v: string | null | undefined) => {
    const k = normKeyTerritoryMatch(v ?? "");
    if (!k) return;
    full.add(k);
    const l = leadToken(v ?? "");
    if (l) lead.add(l);
  };
  for (const { stored, name } of territoryRegionStoredPairs(refs)) {
    add(stored);
    add(name);
  }
  for (const s of territoryRegionPickerNames(refs)) add(s);
  for (const s of stringArrayFromUnknown(refs?.regions)) add(s);
  for (const h of Object.values(hints)) {
    add(h.region_stored);
    add(h.region_label);
  }
  return { full, lead };
}

/** Hudud daraxti bo‘sh bo‘lsa tekshirib bo‘lmaydi — har qanday qiymat qabul. */
export function isKnownTerritoryRegion(
  refs: Record<string, unknown> | undefined,
  region: string,
  hints: Record<string, CityTerritoryHintDto> = buildCityTerritoryHints(refs)
): boolean {
  const { full, lead } = knownRegionKeys(refs, hints);
  if (full.size === 0) return true;
  const candidates = [region, ...lalakuExpandRegionFilterTokens(region)];
  if (candidates.some((t) => full.has(normKeyTerritoryMatch(t)))) return true;
  const l = leadToken(region);
  return l !== "" && lead.has(l);
}

function pickHint(
  hints: Record<string, CityTerritoryHintDto>,
  cityVal: string
): CityTerritoryHintDto | null {
  const t = cityVal.trim();
  if (!t) return null;
  return (
    hints[t] ??
    hints[t.toUpperCase()] ??
    hints[normKeyTerritoryMatch(t)] ??
    null
  );
}

export type ResolvedClientTerritory = {
  region: string | null;
  zone: string | null;
};

/**
 * Shahar bo‘yicha daraxt hintidan область/зона.
 * Forma UI ham shu hintlardan to‘ldiradi — DB bo‘sh qolmasligi uchun yozishda qo‘llaniladi.
 */
export function resolveTerritoryFromCityHints(
  refs: Record<string, unknown> | undefined,
  city: string | null | undefined,
  current?: { region?: string | null; zone?: string | null }
): ResolvedClientTerritory {
  const region = current?.region?.trim() || null;
  const zone = current?.zone?.trim() || null;
  const cityT = city?.trim() || null;
  if (!cityT || (region && zone)) {
    return { region, zone };
  }
  const hint = pickHint(buildCityTerritoryHints(refs), cityT);
  if (!hint) return { region, zone };
  return {
    region: region || hint.region_stored?.trim() || hint.region_label?.trim() || null,
    zone: zone || hint.zone_stored?.trim() || hint.zone_label?.trim() || null
  };
}

async function loadTenantTerritoryRefs(tenantId: number): Promise<Record<string, unknown>> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refsRaw = asRecord(asRecord(tenant?.settings).references);
  return referencesWithResolvedTerritoryNodes(refsRaw);
}

/**
 * Bo‘sh clients.region / zone ni shahar hintidan to‘ldiradi (tarixiy ma’lumot).
 * Report constructor N/A bo‘lmasligi uchun.
 */
export async function backfillEmptyClientTerritoryFromCity(
  tenantId: number,
  opts?: { take?: number }
): Promise<{ updated: number }> {
  const refs = await loadTenantTerritoryRefs(tenantId);
  const hints = buildCityTerritoryHints(refs);
  if (Object.keys(hints).length === 0) return { updated: 0 };

  const rows = await prisma.client.findMany({
    where: {
      tenant_id: tenantId,
      merged_into_client_id: null,
      city: { not: null },
      OR: [{ region: null }, { region: "" }, { zone: null }, { zone: "" }]
    },
    select: { id: true, city: true, region: true, zone: true },
    take: opts?.take ?? 5000
  });

  let updated = 0;
  for (const row of rows) {
    const resolved = resolveTerritoryFromCityHints(refs, row.city, {
      region: row.region,
      zone: row.zone
    });
    const nextRegion = resolved.region;
    const nextZone = resolved.zone;
    const regionChanged = (row.region?.trim() || null) !== nextRegion && Boolean(nextRegion);
    const zoneChanged = (row.zone?.trim() || null) !== nextZone && Boolean(nextZone);
    if (!regionChanged && !zoneChanged) continue;
    await prisma.client.update({
      where: { id: row.id },
      data: {
        ...(regionChanged ? { region: nextRegion } : {}),
        ...(zoneChanged ? { zone: nextZone } : {})
      }
    });
    updated += 1;
  }
  return { updated };
}

/**
 * Create/update payload uchun: shahar bor, область/zona bo‘sh → hint.
 * Hudud daraxtida yo‘q область (qo‘lda yozilgan matn) saqlanmaydi — shahar hintidan yoki bo‘sh.
 */
export async function applyTerritoryHintsToClientInput(
  tenantId: number,
  input: { city?: string | null; region?: string | null; zone?: string | null }
): Promise<{ city?: string | null; region?: string | null; zone?: string | null }> {
  const city = input.city?.trim() || null;
  let region = input.region?.trim() || null;
  const zone = input.zone?.trim() || null;
  if (!city && !region) {
    return { ...input, city, region, zone };
  }
  const refs = await loadTenantTerritoryRefs(tenantId);
  if (region && !isKnownTerritoryRegion(refs, region)) {
    region = null;
  }
  if (!city || (region && zone)) {
    return { ...input, city, region, zone };
  }
  const resolved = resolveTerritoryFromCityHints(refs, city, { region, zone });
  return {
    ...input,
    city,
    region: resolved.region,
    zone: resolved.zone
  };
}
