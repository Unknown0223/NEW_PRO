import { prisma } from "../../config/database";
import { normKeyTerritoryMatch } from "../../../shared/territory-lalaku-seed";
import {
  buildCityTerritoryHints,
  type CityTerritoryHintDto
} from "../tenant-settings/tenant-settings.territory";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { referencesWithResolvedTerritoryNodes } from "../tenant-settings/tenant-settings.service";

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

/** Create/update payload uchun: shahar bor, область/zona bo‘sh → hint. */
export async function applyTerritoryHintsToClientInput(
  tenantId: number,
  input: { city?: string | null; region?: string | null; zone?: string | null }
): Promise<{ city?: string | null; region?: string | null; zone?: string | null }> {
  const city = input.city?.trim() || null;
  const region = input.region?.trim() || null;
  const zone = input.zone?.trim() || null;
  if (!city || (region && zone)) {
    return { ...input, city, region, zone };
  }
  const refs = await loadTenantTerritoryRefs(tenantId);
  const resolved = resolveTerritoryFromCityHints(refs, city, { region, zone });
  return {
    ...input,
    city,
    region: resolved.region,
    zone: resolved.zone
  };
}
