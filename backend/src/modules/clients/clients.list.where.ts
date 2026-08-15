import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  buildCityTerritoryHints,
  expandRegionFilterSynonyms,
  referencesWithResolvedTerritoryNodes
} from "../tenant-settings/tenant-settings.service";
import type { CityTerritoryHintDto } from "../tenant-settings/tenant-settings.service";
import { normKeyTerritoryMatch } from "../../../shared/territory-lalaku-seed";
import type { ListClientsQuery } from "./clients.types";
import { buildClientListSearchOrClause } from "./clients.list.search";

export async function clientIdsWithVisitWeekday(tenantId: number, day: number): Promise<number[]> {
  const d = Math.floor(day);
  if (d < 1 || d > 7) return [];
  const json = JSON.stringify([d]);
  const rows = await prisma.$queryRaw<{ client_id: number }[]>(
    Prisma.sql`
      SELECT DISTINCT client_id
      FROM client_agent_assignments
      WHERE tenant_id = ${tenantId}
        AND visit_weekdays::jsonb @> CAST(${json} AS jsonb)
    `
  );
  return rows.map((r) => r.client_id);
}

/** Agent + hafta kuni — bir xil `client_agent_assignments` qatorida (supervisor dashboard planScope bilan mos). */
export async function clientIdsWithAgentVisitWeekday(
  tenantId: number,
  agentIds: number[],
  day: number
): Promise<number[]> {
  const d = Math.floor(day);
  const uniqAgents = [...new Set(agentIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (d < 1 || d > 7 || uniqAgents.length === 0) return [];
  const json = JSON.stringify([d]);
  const rows = await prisma.$queryRaw<{ client_id: number }[]>(
    Prisma.sql`
      SELECT DISTINCT client_id
      FROM client_agent_assignments
      WHERE tenant_id = ${tenantId}
        AND agent_id IN (${Prisma.join(uniqAgents)})
        AND visit_weekdays::jsonb @> CAST(${json} AS jsonb)
    `
  );
  return rows.map((r) => r.client_id);
}

async function loadTenantReferencesForClientTerritoryFilters(tenantId: number): Promise<{
  hints: Record<string, CityTerritoryHintDto>;
  ref: Record<string, unknown> | undefined;
}> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refRaw = (row?.settings as { references?: Record<string, unknown> } | null)?.references as
    | Record<string, unknown>
    | undefined;
  const ref = refRaw ? referencesWithResolvedTerritoryNodes(refRaw) : undefined;
  return {
    hints: buildCityTerritoryHints(ref),
    ref
  };
}

function cityKeysMatchingRegionInHints(
  hints: Record<string, CityTerritoryHintDto>,
  regionFilter: string
): string[] {
  const rf = regionFilter.trim();
  if (!rf) return [];
  const rfNorm = normKeyTerritoryMatch(rf);
  const uniq = new Set<string>();
  for (const [cityKey, hint] of Object.entries(hints)) {
    const rs = (hint.region_stored ?? "").trim();
    const rl = (hint.region_label ?? "").trim();
    if (!rs && !rl) continue;
    const match =
      rs === rf ||
      rl === rf ||
      normKeyTerritoryMatch(rs) === rfNorm ||
      normKeyTerritoryMatch(rl) === rfNorm;
    if (match) {
      const k = cityKey.trim();
      if (k) uniq.add(k);
    }
  }
  return [...uniq];
}

function cityKeysMatchingZoneInHints(
  hints: Record<string, CityTerritoryHintDto>,
  zoneFilter: string
): string[] {
  const zf = zoneFilter.trim();
  if (!zf) return [];
  const zfNorm = normKeyTerritoryMatch(zf);
  const uniq = new Set<string>();
  for (const [cityKey, hint] of Object.entries(hints)) {
    const zs = (hint.zone_stored ?? "").trim();
    const zl = (hint.zone_label ?? "").trim();
    if (!zs && !zl) continue;
    const match =
      zs === zf ||
      zl === zf ||
      normKeyTerritoryMatch(zs) === zfNorm ||
      normKeyTerritoryMatch(zl) === zfNorm;
    if (match) {
      const k = cityKey.trim();
      if (k) uniq.add(k);
    }
  }
  return [...uniq];
}

/** Ro‘yxat, eksport va count uchun umumiy WHERE. `null` — hech qachon mos kelmas (masalan hafta kuni bo‘yicha bo‘sh). */
export async function buildClientListWhereInput(
  tenantId: number,
  q: ListClientsQuery
): Promise<Prisma.ClientWhereInput | null> {
  const andList: Prisma.ClientWhereInput[] = [{ tenant_id: tenantId, merged_into_client_id: null }];

  const regionQ = q.region?.trim();
  const zoneList = [
    ...(q.zones?.map((z) => z.trim()).filter(Boolean) ?? []),
    ...(q.zone?.trim() ? [q.zone.trim()] : [])
  ];
  const zoneKeys = [...new Set(zoneList)];
  const territoryBundle =
    regionQ || zoneKeys.length > 0
      ? await loadTenantReferencesForClientTerritoryFilters(tenantId)
      : { hints: {} as Record<string, CityTerritoryHintDto>, ref: undefined as Record<string, unknown> | undefined };

  if (q.is_active === true) andList.push({ is_active: true });
  if (q.is_active === false) andList.push({ is_active: false });
  const cat = q.category?.trim();
  if (cat) andList.push({ category: cat });
  if (regionQ) {
    const cityKeys = cityKeysMatchingRegionInHints(territoryBundle.hints, regionQ);
    const regionSynonyms = expandRegionFilterSynonyms(territoryBundle.ref, regionQ);
    const orRegion: Prisma.ClientWhereInput[] = regionSynonyms.map((v) => ({
      region: { equals: v, mode: "insensitive" }
    }));
    if (cityKeys.length > 0) orRegion.push({ city: { in: cityKeys } });
    andList.push({ OR: orRegion });
  }
  const district = q.district?.trim();
  if (district) andList.push({ district });
  const neighborhood = q.neighborhood?.trim();
  if (neighborhood) andList.push({ neighborhood });
  if (zoneKeys.length > 0) {
    const orZone: Prisma.ClientWhereInput[] = [];
    for (const zoneQ of zoneKeys) {
      const cityKeys = cityKeysMatchingZoneInHints(territoryBundle.hints, zoneQ);
      orZone.push(
        { zone: zoneQ },
        { zone: { equals: zoneQ, mode: "insensitive" } },
        ...(cityKeys.length > 0 ? [{ city: { in: cityKeys } }] : [])
      );
    }
    andList.push({ OR: orZone });
  }
  const city = q.city?.trim();
  if (city) andList.push({ city });
  const ctc = q.client_type_code?.trim();
  if (ctc) andList.push({ client_type_code: ctc });
  const cf = q.client_format?.trim();
  if (cf) andList.push({ client_format: cf });
  const sc = q.sales_channel?.trim();
  if (sc) andList.push({ sales_channel: sc });

  const agentIds = [
    ...(q.agent_ids?.filter((n) => Number.isFinite(n) && n > 0) ?? []),
    ...(q.agent_id != null && Number.isFinite(q.agent_id) && q.agent_id > 0 ? [q.agent_id] : [])
  ];
  const uniqAgentIds = [...new Set(agentIds)];

  if (Array.isArray(q.client_ids)) {
    const ids = q.client_ids
      .map((n) => (typeof n === "number" ? n : Number(n)))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length === 0) return null;
    andList.push({ id: { in: ids } });
  }

  const expeditorIds = [
    ...(q.expeditor_user_ids?.filter((n) => Number.isFinite(n) && n > 0) ?? []),
    ...(q.expeditor_user_id != null && Number.isFinite(q.expeditor_user_id) && q.expeditor_user_id > 0
      ? [q.expeditor_user_id]
      : [])
  ];
  const uniqExpeditorIds = [...new Set(expeditorIds)];
  if (uniqExpeditorIds.length > 0) {
    andList.push({
      OR: uniqExpeditorIds.map((eid) => ({
        agent_assignments: { some: { expeditor_user_id: eid } }
      }))
    });
  }

  const visitDays = [
    ...(q.visit_weekdays?.filter((n) => n >= 1 && n <= 7) ?? []),
    ...(q.visit_weekday != null && Number.isFinite(q.visit_weekday) && q.visit_weekday >= 1 && q.visit_weekday <= 7
      ? [q.visit_weekday]
      : [])
  ];
  const uniqVisitDays = [...new Set(visitDays)];

  if (uniqAgentIds.length > 0 && uniqVisitDays.length > 0) {
    const clientIdSet = new Set<number>();
    for (const day of uniqVisitDays) {
      const ids = await clientIdsWithAgentVisitWeekday(tenantId, uniqAgentIds, day);
      ids.forEach((id) => clientIdSet.add(id));
    }
    if (clientIdSet.size === 0) return null;
    andList.push({ id: { in: [...clientIdSet] } });
  } else {
    if (uniqAgentIds.length > 0) {
      andList.push({
        OR: uniqAgentIds.map((aid) => ({
          OR: [{ agent_id: aid }, { agent_assignments: { some: { agent_id: aid } } }]
        }))
      });
    }
    if (uniqVisitDays.length > 0) {
      const clientIdSet = new Set<number>();
      for (const day of uniqVisitDays) {
        const ids = await clientIdsWithVisitWeekday(tenantId, day);
        ids.forEach((id) => clientIdSet.add(id));
      }
      if (clientIdSet.size === 0) return null;
      andList.push({ id: { in: [...clientIdSet] } });
    }
  }

  const innQ = q.inn?.trim();
  if (innQ) {
    andList.push({ inn: { contains: innQ, mode: "insensitive" } });
  }
  const phoneQ = q.phone?.trim();
  if (phoneQ) {
    andList.push({ phone: { contains: phoneQ, mode: "insensitive" } });
  }

  const pinflQ = q.client_pinfl?.trim();
  if (pinflQ) {
    andList.push({ client_pinfl: { contains: pinflQ, mode: "insensitive" } });
  }

  if (q.has_active_equipment === true) {
    andList.push({
      client_equipment: { some: { removed_at: null } }
    });
  } else if (q.has_active_equipment === false) {
    andList.push({
      NOT: { client_equipment: { some: { removed_at: null } } }
    });
  }

  const equipQ = q.equipment_kind?.trim();
  if (equipQ) {
    andList.push({
      client_equipment: {
        some: {
          removed_at: null,
          OR: [
            { equipment_kind: { contains: equipQ, mode: "insensitive" } },
            { inventory_type: { contains: equipQ, mode: "insensitive" } }
          ]
        }
      }
    });
  }

  const zeroCredit = new Prisma.Decimal(0);
  if (q.has_credit === true) {
    andList.push({ credit_limit: { gt: zeroCredit } });
  } else if (q.has_credit === false) {
    andList.push({ credit_limit: { lte: zeroCredit } });
  }

  if (q.agent_consignment === "yes") {
    andList.push({
      OR: [
        { agent: { consignment: true } },
        { agent_assignments: { some: { agent: { consignment: true } } } }
      ]
    });
  } else if (q.agent_consignment === "no") {
    andList.push({
      NOT: {
        OR: [
          { agent: { consignment: true } },
          { agent_assignments: { some: { agent: { consignment: true } } } }
        ]
      }
    });
  }

  if (q.agent_consignment_limited === "yes") {
    andList.push({
      OR: [
        { agent: { consignment_limit_amount: { not: null } } },
        {
          agent_assignments: {
            some: { agent: { consignment_limit_amount: { not: null } } }
          }
        }
      ]
    });
  } else if (q.agent_consignment_limited === "no") {
    andList.push({
      NOT: {
        OR: [
          { agent: { consignment_limit_amount: { not: null } } },
          {
            agent_assignments: {
              some: { agent: { consignment_limit_amount: { not: null } } }
            }
          }
        ]
      }
    });
  }

  const createdAtFilter: Prisma.DateTimeFilter = {};
  const crFrom = q.created_from?.trim();
  const crTo = q.created_to?.trim();
  if (crFrom) {
    const d = new Date(`${crFrom}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) createdAtFilter.gte = d;
  }
  if (crTo) {
    const d = new Date(`${crTo}T23:59:59.999Z`);
    if (!Number.isNaN(d.getTime())) createdAtFilter.lte = d;
  }
  if (Object.keys(createdAtFilter).length > 0) {
    andList.push({ created_at: createdAtFilter });
  }

  const supervisorIds = [
    ...(q.supervisor_user_ids?.filter((n) => Number.isFinite(n) && n > 0) ?? []),
    ...(q.supervisor_user_id != null && Number.isFinite(q.supervisor_user_id) && q.supervisor_user_id > 0
      ? [Math.floor(q.supervisor_user_id)]
      : [])
  ];
  const uniqSupervisorIds = [...new Set(supervisorIds)];
  if (uniqSupervisorIds.length > 0) {
    andList.push({
      OR: uniqSupervisorIds.map((sid) => ({
        OR: [
          { agent: { supervisor_user_id: sid } },
          { agent_assignments: { some: { agent: { supervisor_user_id: sid } } } }
        ]
      }))
    });
  }

  if (q.has_inn === true) {
    andList.push({
      AND: [{ inn: { not: null } }, { NOT: { inn: "" } }]
    });
  } else if (q.has_inn === false) {
    andList.push({
      OR: [{ inn: null }, { inn: "" }]
    });
  }

  if (q.has_phone === true) {
    andList.push({
      AND: [{ phone: { not: null } }, { NOT: { phone: "" } }]
    });
  } else if (q.has_phone === false) {
    andList.push({
      OR: [{ phone: null }, { phone: "" }]
    });
  }

  const searchOr = buildClientListSearchOrClause(q.search ?? "");
  if (searchOr.length > 0) {
    andList.push({ OR: searchOr });
  }

  if (q.has_coords === true) {
    andList.push({
      latitude: { not: null },
      longitude: { not: null }
    });
  }

  if (q.missing_coords === true) {
    andList.push({
      OR: [{ latitude: null }, { longitude: null }]
    });
  }

  if (q.tag_id != null && q.tag_id > 0) {
    andList.push({
      tag_links: { some: { tag_id: q.tag_id } }
    });
  }

  if (q.price_type?.trim()) {
    andList.push({ price_type: q.price_type.trim() });
  }

  if (q.allow_order_with_debt === true) {
    andList.push({ allow_order_with_debt: true });
  } else if (q.allow_order_with_debt === false) {
    andList.push({ allow_order_with_debt: false });
  }

  return { AND: andList };
}
