import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ListClientsQuery } from "./clients.types";
import { buildClientListSearchOrClause } from "./clients.list.search";
import type { ScopedReportActor } from "../access/access-agent-scope";
import { intersectRequestedAgentIds } from "../access/access-agent-scope";
import {
  clientWhereForRegionFilter,
  clientWhereForZoneFilter,
  loadClientTerritoryFilterBundle
} from "./clients.territory-filter";

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

/** Ro‘yxat, eksport va count uchun umumiy WHERE. `null` — hech qachon mos kelmas (masalan hafta kuni bo‘yicha bo‘sh). */
export async function buildClientListWhereInput(
  tenantId: number,
  q: ListClientsQuery,
  actorScope?: ScopedReportActor
): Promise<Prisma.ClientWhereInput | null> {
  const andList: Prisma.ClientWhereInput[] = [{ tenant_id: tenantId, merged_into_client_id: null }];

  const regionList = [
    ...(q.regions?.map((r) => r.trim()).filter(Boolean) ?? []),
    ...(q.region?.trim() ? [q.region.trim()] : [])
  ];
  const regionKeys = [...new Set(regionList)];
  const zoneList = [
    ...(q.zones?.map((z) => z.trim()).filter(Boolean) ?? []),
    ...(q.zone?.trim() ? [q.zone.trim()] : [])
  ];
  const zoneKeys = [...new Set(zoneList)];
  const territoryBundle =
    regionKeys.length > 0 || zoneKeys.length > 0
      ? await loadClientTerritoryFilterBundle(tenantId)
      : { hints: {}, ref: undefined };

  if (q.is_active === true) andList.push({ is_active: true });
  if (q.is_active === false) andList.push({ is_active: false });
  const categories = [
    ...(q.categories?.map((c) => c.trim()).filter(Boolean) ?? []),
    ...(q.category?.trim() ? [q.category.trim()] : [])
  ];
  const categoryKeys = [...new Set(categories)];
  if (categoryKeys.length === 1) andList.push({ category: categoryKeys[0] });
  else if (categoryKeys.length > 1) andList.push({ category: { in: categoryKeys } });
  if (regionKeys.length > 0) {
    const clause = clientWhereForRegionFilter(territoryBundle, regionKeys);
    if (clause) andList.push(clause);
  }
  const district = q.district?.trim();
  if (district) andList.push({ district });
  const neighborhood = q.neighborhood?.trim();
  if (neighborhood) andList.push({ neighborhood });
  if (zoneKeys.length > 0) {
    const clause = clientWhereForZoneFilter(territoryBundle, zoneKeys);
    if (clause) andList.push(clause);
  }
  const cities = [
    ...(q.cities?.map((c) => c.trim()).filter(Boolean) ?? []),
    ...(q.city?.trim() ? [q.city.trim()] : [])
  ];
  const cityKeys = [...new Set(cities)];
  if (cityKeys.length === 1) andList.push({ city: cityKeys[0] });
  else if (cityKeys.length > 1) andList.push({ city: { in: cityKeys } });
  const typeCodes = [
    ...(q.client_type_codes?.map((c) => c.trim()).filter(Boolean) ?? []),
    ...(q.client_type_code?.trim() ? [q.client_type_code.trim()] : [])
  ];
  const typeKeys = [...new Set(typeCodes)];
  if (typeKeys.length === 1) andList.push({ client_type_code: typeKeys[0] });
  else if (typeKeys.length > 1) andList.push({ client_type_code: { in: typeKeys } });
  const formats = [
    ...(q.client_formats?.map((c) => c.trim()).filter(Boolean) ?? []),
    ...(q.client_format?.trim() ? [q.client_format.trim()] : [])
  ];
  const formatKeys = [...new Set(formats)];
  if (formatKeys.length === 1) andList.push({ client_format: formatKeys[0] });
  else if (formatKeys.length > 1) andList.push({ client_format: { in: formatKeys } });
  const channels = [
    ...(q.sales_channels?.map((c) => c.trim()).filter(Boolean) ?? []),
    ...(q.sales_channel?.trim() ? [q.sales_channel.trim()] : [])
  ];
  const channelKeys = [...new Set(channels)];
  if (channelKeys.length === 1) andList.push({ sales_channel: channelKeys[0] });
  else if (channelKeys.length > 1) andList.push({ sales_channel: { in: channelKeys } });

  const agentIds = [
    ...(q.agent_ids?.filter((n) => Number.isFinite(n) && n > 0) ?? []),
    ...(q.agent_id != null && Number.isFinite(q.agent_id) && q.agent_id > 0 ? [q.agent_id] : [])
  ];
  let uniqAgentIds = [...new Set(agentIds)];
  if (actorScope) {
    const scoped = intersectRequestedAgentIds(uniqAgentIds, actorScope);
    if (scoped.restricted) {
      uniqAgentIds = scoped.agentIds;
      if (uniqAgentIds.length === 0) return null;
    }
  }

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

  const equipKinds = [
    ...(q.equipment_kinds?.map((k) => k.trim()).filter(Boolean) ?? []),
    ...(q.equipment_kind?.trim() ? [q.equipment_kind.trim()] : [])
  ];
  const equipKeys = [...new Set(equipKinds)];
  if (equipKeys.length === 1) {
    const equipQ = equipKeys[0]!;
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
  } else if (equipKeys.length > 1) {
    andList.push({
      client_equipment: {
        some: {
          removed_at: null,
          OR: equipKeys.flatMap((equipQ) => [
            { equipment_kind: { contains: equipQ, mode: "insensitive" as const } },
            { inventory_type: { contains: equipQ, mode: "insensitive" as const } }
          ])
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
