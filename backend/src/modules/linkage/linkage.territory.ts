import { prisma } from "../../config/database";
import { validateCheckin } from "../territory/territory.service";
import { buildCityTerritoryHints } from "../tenant-settings/tenant-settings.territory";
import type { ClientAddressTerritoryInput } from "./linkage.types";
import {
  staffTerritoriesMatchAddress,
  territoryTokensMatch
} from "./linkage.territory-match.pure";

async function resolveTerritoryIdsForClient(
  tenantId: number,
  client: {
    latitude: unknown;
    longitude: unknown;
    region: string | null;
    city: string | null;
    district: string | null;
    zone: string | null;
  }
): Promise<number[]> {
  const ids = new Set<number>();
  const lat = client.latitude != null ? Number(client.latitude as number | string) : NaN;
  const lng = client.longitude != null ? Number(client.longitude as number | string) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const hit = await validateCheckin(tenantId, null, lat, lng);
    if (hit.inside && hit.territory_id != null) ids.add(hit.territory_id);
  }
  const terms = [
    ...new Set(
      [client.region, client.city, client.district, client.zone]
        .map((s) => (s ?? "").trim())
        .filter((s) => s.length > 0)
    )
  ];
  if (terms.length === 0) return [...ids];
  const rows = await prisma.territory.findMany({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      is_active: true,
      OR: terms.flatMap((t) => [
        { code: { equals: t, mode: "insensitive" } },
        { name: { equals: t, mode: "insensitive" } }
      ])
    },
    select: { id: true }
  });
  for (const r of rows) ids.add(r.id);
  return [...ids];
}

async function listStaffUserIdsLinkedToTerritories(
  tenantId: number,
  territoryIds: number[],
  role: "agent" | "expeditor"
): Promise<number[]> {
  if (territoryIds.length === 0) return [];
  const linkRows = await prisma.territoryUserLink.findMany({
    where: { territory_id: { in: territoryIds } },
    select: { user_id: true }
  });
  const uids = [...new Set(linkRows.map((r) => r.user_id))].filter((n) => Number.isInteger(n) && n > 0);
  if (uids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: uids }, role, is_active: true },
    select: { id: true }
  });
  return rows.map((r) => r.id);
}

type AddrParts = { zone: string | null; region: string | null; city: string | null };

/** Klient kod/nom + territory_nodes hints → bir nechta manzil variantlari (match uchun). */
async function expandAddressMatchVariants(
  tenantId: number,
  address: AddrParts
): Promise<AddrParts[]> {
  const base = { ...address };
  const variants: AddrParts[] = [base];
  const city = address.city?.trim();
  if (!city) return variants;

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { settings: true }
  });
  const settings =
    tenant?.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? (tenant.settings as Record<string, unknown>)
      : undefined;
  const hints = buildCityTerritoryHints(settings);
  const hint =
    hints[city] ??
    Object.entries(hints).find(([k]) => territoryTokensMatch(k, city))?.[1] ??
    null;
  if (!hint) return variants;

  const cityLabel = hint.city_label?.trim() || null;
  const regionStored = hint.region_stored?.trim() || null;
  const regionLabel = hint.region_label?.trim() || null;
  const zoneStored = hint.zone_stored?.trim() || null;
  const zoneLabel = hint.zone_label?.trim() || null;

  const cities = [...new Set([city, cityLabel].filter((x): x is string => Boolean(x)))];
  const regions = [
    ...new Set(
      [address.region, regionStored, regionLabel].filter((x): x is string => Boolean(x?.trim()))
    )
  ];
  const zones = [
    ...new Set([address.zone, zoneStored, zoneLabel].filter((x): x is string => Boolean(x?.trim())))
  ];

  for (const c of cities) {
    for (const r of regions.length ? regions : [address.region]) {
      for (const z of zones.length ? zones : [address.zone]) {
        variants.push({
          city: c,
          region: r?.trim() || null,
          zone: z?.trim() || null
        });
      }
    }
  }
  return variants;
}

function addressVariantsMatch(blobs: string[], variants: AddrParts[]): boolean {
  return variants.some((v) => staffTerritoriesMatchAddress(blobs, v));
}

/**
 * Work-slot `territory` / `territories` va `users.territory` —
 * ish joyidagi zona/oblast/shahar kaskadi bilan bir xil.
 */
async function listStaffUserIdsByAddressTerritoryStrings(
  tenantId: number,
  address: AddrParts,
  role: "agent" | "expeditor"
): Promise<number[]> {
  const terms = [address.zone, address.region, address.city]
    .map((s) => (s ?? "").trim())
    .filter((s) => s.length >= 2);
  if (terms.length === 0) return [];

  const slotType = role === "agent" ? "agent" : "expeditor";
  const variants = await expandAddressMatchVariants(tenantId, address);

  const [slotRows, usersByField] = await Promise.all([
    prisma.workSlot.findMany({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        slot_type: slotType,
        is_active: true
      },
      select: {
        territory: true,
        territories: true,
        user_links: {
          where: { ended_at: null },
          select: { user_id: true }
        }
      },
      take: 3000
    }),
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role,
        is_active: true,
        territory: { not: null }
      },
      select: { id: true, territory: true },
      take: 3000
    })
  ]);

  const fromSlots = new Set<number>();
  for (const slot of slotRows) {
    const blobs = [
      ...(typeof slot.territory === "string" && slot.territory.trim() ? [slot.territory.trim()] : []),
      ...((slot.territories ?? []).filter((t): t is string => typeof t === "string" && t.trim().length > 0))
    ];
    if (!addressVariantsMatch(blobs, variants)) continue;
    for (const link of slot.user_links) {
      if (Number.isInteger(link.user_id) && link.user_id > 0) fromSlots.add(link.user_id);
    }
  }

  const fromUsers = new Set<number>();
  for (const u of usersByField) {
    if (addressVariantsMatch([u.territory ?? ""], variants)) fromUsers.add(u.id);
  }

  const ids = [...new Set([...fromSlots, ...fromUsers])];
  if (ids.length === 0) return [];

  // Slotdan kelganlar — slot_type allaqachon agent/expeditor; role chalkashsa ham ko‘rsatamiz.
  const inTenant = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: ids },
      is_active: true,
      OR: [{ role }, { id: { in: [...fromSlots] } }]
    },
    select: { id: true }
  });
  return inTenant.map((u) => u.id);
}

function uniquePositive(ids: number[]): number[] {
  return [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
}

/**
 * Klient manzili / GPS bo‘yicha agent va dastavchik tanlovi:
 * 1) `territories` + `territory_user_links`
 * 2) work-slot / users.territory (Рабочие места kaskadi)
 */
export async function getAgentPickerContextForAddress(
  tenantId: number,
  input: ClientAddressTerritoryInput
): Promise<{
  territory_matched: boolean;
  territory_ids: number[];
  agent_ids: number[];
  expeditor_ids: number[];
  /** 2+ hudud agenti — avtomatik tanlash mumkin emas (Q-05). */
  agent_pick_ambiguous: boolean;
  requires_supervisor_review: boolean;
}> {
  const address = {
    zone: input.zone?.trim() ? input.zone.trim() : null,
    region: input.region?.trim() ? input.region.trim() : null,
    city: input.city?.trim() ? input.city.trim() : null
  };
  const hasAddressTerms = Boolean(address.zone || address.region || address.city);

  const territory_ids = await resolveTerritoryIdsForClient(tenantId, input);
  const [linkedAgents, linkedExpeditors, stringAgents, stringExpeditors] = await Promise.all([
    listStaffUserIdsLinkedToTerritories(tenantId, territory_ids, "agent"),
    listStaffUserIdsLinkedToTerritories(tenantId, territory_ids, "expeditor"),
    listStaffUserIdsByAddressTerritoryStrings(tenantId, address, "agent"),
    listStaffUserIdsByAddressTerritoryStrings(tenantId, address, "expeditor")
  ]);

  const agent_ids = uniquePositive([...linkedAgents, ...stringAgents]);
  const expeditor_ids = uniquePositive([...linkedExpeditors, ...stringExpeditors]);

  const territory_matched =
    territory_ids.length > 0 || hasAddressTerms || agent_ids.length > 0 || expeditor_ids.length > 0;

  if (!territory_matched) {
    return {
      territory_matched: false,
      territory_ids: [],
      agent_ids: [],
      expeditor_ids: [],
      agent_pick_ambiguous: false,
      requires_supervisor_review: false
    };
  }

  const uniqueAgents = [...new Set(agent_ids)].filter((id) => id > 0);
  const ambiguous = uniqueAgents.length >= 2;
  return {
    territory_matched: true,
    territory_ids,
    agent_ids,
    expeditor_ids,
    agent_pick_ambiguous: ambiguous,
    requires_supervisor_review: ambiguous
  };
}

export async function mergeAgentsFromClientTerritories(
  tenantId: number,
  client: ClientAddressTerritoryInput,
  agentIds: Set<number>
): Promise<void> {
  const { agent_ids } = await getAgentPickerContextForAddress(tenantId, client);
  for (const id of agent_ids) agentIds.add(id);
}
