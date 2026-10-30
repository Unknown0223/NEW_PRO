import { prisma } from "../../config/database";
import { getTenantProfile, referencesWithResolvedTerritoryNodes } from "../tenant-settings/tenant-settings.service";
import { territoryNodesFromUnknown } from "../tenant-settings/tenant-settings.refs";
import { getMobileAgentAssignedCities } from "../mobile/mobile-agent-cities";
import { citiesByZoneRegionFromTerritoryNodes } from "../mobile/mobile-territory-references";
import { getClientReferences } from "./clients.references";

export type CreatorTerritoryOptions = {
  /** Creatorda bog‘langan hududlar bor — ro‘yxat shu bilan cheklanadi. */
  scoped: boolean;
  cities: { value: string; label: string; zone: string | null; region: string | null }[];
  regions: { value: string; label: string }[];
  zones: string[];
};

/**
 * Mijoz yaratish/tahrirlash: yaratuvchiga bog‘langan barcha zona/oblast/gorod.
 * Scope yo‘q (admin va h.k.) — scoped=false, UI to‘liq spravochnikdan foydalanadi.
 */
export async function getCreatorTerritoryOptions(
  tenantId: number,
  actorUserId: number | null
): Promise<CreatorTerritoryOptions> {
  if (actorUserId == null || actorUserId < 1) {
    return { scoped: false, cities: [], regions: [], zones: [] };
  }

  const refs = await getClientReferences(tenantId);
  const hints = refs.city_territory_hints ?? {};
  const profile = await getTenantProfile(tenantId);
  const refInner = profile.references as unknown as Record<string, unknown>;
  const refT = referencesWithResolvedTerritoryNodes(refInner);
  const territoryNodes = territoryNodesFromUnknown(refT.territory_nodes);
  const citiesByZoneRegion = citiesByZoneRegionFromTerritoryNodes(territoryNodes);

  const cities = await getMobileAgentAssignedCities(tenantId, actorUserId, hints, {
    territoryNodes,
    citiesByZoneRegion,
    allTenantCities: refs.cities ?? []
  });

  const actor = await prisma.user.findFirst({
    where: { id: actorUserId, tenant_id: tenantId },
    select: { territory: true }
  });
  const slot = await prisma.slotUserLink.findFirst({
    where: {
      tenant_id: tenantId,
      user_id: actorUserId,
      ended_at: null,
      slot: { tenant_id: tenantId, deleted_at: null }
    },
    select: { slot: { select: { territories: true, territory: true } } }
  });
  const territoryLinks = await prisma.territoryUserLink.count({
    where: {
      user_id: actorUserId,
      territory: { tenant_id: tenantId, deleted_at: null, is_active: true }
    }
  });
  const hasSlotTerritory =
    (slot?.slot.territories?.length ?? 0) > 0 || Boolean(slot?.slot.territory?.trim());
  const hasUserTerritory = Boolean(actor?.territory?.trim());
  const scoped = cities.length > 0 && (territoryLinks > 0 || hasSlotTerritory || hasUserTerritory);

  if (!scoped) {
    return { scoped: false, cities: [], regions: [], zones: [] };
  }

  const regionMap = new Map<string, string>();
  const zones = new Set<string>();
  for (const c of cities) {
    if (c.region?.trim()) {
      const v = c.region.trim();
      if (!regionMap.has(v)) regionMap.set(v, v);
    }
    if (c.zone?.trim()) zones.add(c.zone.trim());
  }

  return {
    scoped: true,
    cities: cities.map((c) => ({
      value: c.value,
      label: c.label,
      zone: c.zone,
      region: c.region
    })),
    regions: [...regionMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    zones: [...zones].sort((a, b) => a.localeCompare(b, "ru"))
  };
}
