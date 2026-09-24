import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  EMPTY_ACCESS_SCOPE,
  actorHasUnrestrictedDataScope,
  buildClientAgentScopeWhere,
  buildScopedAgentWhere,
  buildScopedStaffDirectoryWhere,
  isOrderAgentAllowedForActor,
  resolveStaffVisibilityByExplicitAndGeo,
  resolveVisibleStaffIds,
  uniquePositiveIds,
  type AccessAgentScope,
  type ScopedReportActor
} from "./access-staff-scope";
import {
  mergeBranchCodesForScope,
  mergeCashDeskIdsForScope,
  mergeGeoStaffIds,
  mergeTerritoryTermsForScope,
  mergeWarehouseIdsForScope
} from "./access-scope-from-slot";

export type { AccessAgentScope, ScopedReportActor } from "./access-staff-scope";
export {
  buildActorPaymentGrantOr,
  buildClientAgentScopeWhere,
  buildOrderAgentScopeWhere,
  buildScopedAgentDirectoryWhere,
  buildScopedAgentExistsSql,
  buildScopedAgentWhere,
  buildScopedStaffDirectoryWhere,
  intersectRequestedAgentIds,
  isOrderAgentAllowedForActor,
  resolveAllowedAgentIdsForActor,
  resolveStaffVisibilityByExplicitAndGeo,
  resolveVisibleStaffIds
} from "./access-staff-scope";

export type LoadAccessScopeOpts = {
  /** Staff katalogi — neaktiv qatorlar ham. Hisobotlar — faqat faol. */
  includeInactive?: boolean;
};

async function listStaffIdsLinkedToTerritories(
  tenantId: number,
  territoryIds: number[],
  opts: { includeInactive: boolean }
): Promise<number[]> {
  if (territoryIds.length === 0) return [];
  const [linkRows, territories] = await Promise.all([
    prisma.territoryUserLink.findMany({
      where: { territory_id: { in: territoryIds }, territory: { tenant_id: tenantId } },
      select: { user_id: true }
    }),
    prisma.territory.findMany({
      where: { tenant_id: tenantId, id: { in: territoryIds }, deleted_at: null },
      select: { name: true, code: true }
    })
  ]);
  const ids = new Set(uniquePositiveIds(linkRows.map((l) => l.user_id)));
  const terms = [
    ...new Set(
      territories.flatMap((t) => [t.name?.trim(), t.code?.trim()]).filter((s): s is string => Boolean(s))
    )
  ];
  if (terms.length > 0) {
    const stringMatches = await listStaffIdsByTerritoryTerms(tenantId, terms, opts);
    for (const id of stringMatches) ids.add(id);
  }
  if (ids.size === 0) return [];
  const inTenant = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: [...ids] },
      ...(opts.includeInactive ? {} : { is_active: true })
    },
    select: { id: true }
  });
  return inTenant.map((u) => u.id);
}

async function listStaffIdsByTerritoryTerms(
  tenantId: number,
  terms: string[],
  opts: { includeInactive: boolean }
): Promise<number[]> {
  const cleaned = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 2))];
  if (cleaned.length === 0) return [];
  // Juda ko‘p termin (201 shahar) — OR portlashini cheklaymiz
  const limited = cleaned.slice(0, 80);
  const [byUserField, slotRows] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        ...(opts.includeInactive ? {} : { is_active: true }),
        OR: limited.flatMap((term) => [
          { territory: { equals: term, mode: "insensitive" as const } },
          { territory: { contains: term, mode: "insensitive" as const } }
        ])
      },
      select: { id: true }
    }),
    // Faqat terminlarga mos slotlar — barcha territories[] tortilmasin
    prisma.workSlot.findMany({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        OR: limited.flatMap((term) => [
          { territory: { equals: term, mode: "insensitive" as const } },
          { territory: { contains: term, mode: "insensitive" as const } },
          { territories: { has: term } }
        ])
      },
      select: {
        territory: true,
        territories: true,
        user_links: {
          where: { ended_at: null },
          select: { user_id: true }
        }
      }
    })
  ]);
  const ids = new Set<number>(byUserField.map((r) => r.id));
  const termLower = limited.map((t) => t.toLowerCase());
  for (const slot of slotRows) {
    const blob = [slot.territory ?? "", ...(slot.territories ?? [])].join(" | ").toLowerCase();
    const hit = termLower.some((t) => t.length >= 3 && blob.includes(t));
    if (!hit) continue;
    for (const link of slot.user_links) ids.add(link.user_id);
  }
  if (ids.size === 0) return [];
  const inTenant = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: [...ids] },
      ...(opts.includeInactive ? {} : { is_active: true })
    },
    select: { id: true }
  });
  return inTenant.map((u) => u.id);
}

async function listStaffIdsLinkedToBranches(
  tenantId: number,
  branchCodes: string[],
  opts: { includeInactive: boolean }
): Promise<number[]> {
  const codes = [...new Set(branchCodes.map((c) => c.trim()).filter(Boolean))];
  if (codes.length === 0) return [];
  const [byField, byLink, bySlot] = await Promise.all([
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        ...(opts.includeInactive ? {} : { is_active: true }),
        OR: codes.flatMap((code) => [
          { branch: { equals: code, mode: "insensitive" as const } },
          { branch: { contains: code, mode: "insensitive" as const } }
        ])
      },
      select: { id: true }
    }),
    prisma.userBranchLink.findMany({
      where: {
        tenant_id: tenantId,
        branch_code: { in: codes }
      },
      select: { user_id: true }
    }),
    prisma.workSlot.findMany({
      where: {
        tenant_id: tenantId,
        deleted_at: null,
        OR: codes.flatMap((code) => [
          { branch_code: { equals: code, mode: "insensitive" as const } },
          { branch_codes: { has: code } }
        ])
      },
      select: {
        user_links: {
          where: { ended_at: null },
          select: { user_id: true }
        }
      }
    })
  ]);
  const ids = new Set<number>([
    ...byField.map((u) => u.id),
    ...byLink.map((l) => l.user_id)
  ]);
  for (const slot of bySlot) {
    for (const link of slot.user_links) ids.add(link.user_id);
  }
  if (ids.size === 0) return [];
  const inTenant = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: [...ids] },
      ...(opts.includeInactive ? {} : { is_active: true })
    },
    select: { id: true }
  });
  return inTenant.map((u) => u.id);
}

/** Hisobotlar uchun (faqat faol agentlar). */
export async function loadAccessAgentScope(tenantId: number, userId: number): Promise<AccessAgentScope> {
  return loadAccessDataScope(tenantId, userId, { includeInactive: false });
}

export async function loadAccessDataScope(
  tenantId: number,
  userId: number,
  opts?: LoadAccessScopeOpts
): Promise<AccessAgentScope> {
  const includeInactive = opts?.includeInactive === true;
  const activeClause = includeInactive ? {} : { is_active: true };

  const [u, supervisees, territoryLinks, warehouseLinks, cashLinks, branchLinks, activeSlotLink] =
    await Promise.all([
      prisma.user.findFirst({
        where: { id: userId, tenant_id: tenantId },
        select: {
          territory: true,
          trade_direction_links: { select: { trade_direction_id: true } }
        }
      }),
      prisma.user.findMany({
        where: { tenant_id: tenantId, supervisor_user_id: userId, ...activeClause },
        select: { id: true }
      }),
      prisma.territoryUserLink.findMany({
        where: { user_id: userId, territory: { tenant_id: tenantId, deleted_at: null } },
        select: { territory_id: true }
      }),
      prisma.warehouseUserLink.findMany({
        where: { user_id: userId },
        select: { warehouse_id: true }
      }),
      prisma.cashDeskUserLink.findMany({
        where: { user_id: userId },
        select: { cash_desk_id: true }
      }),
      prisma.userBranchLink.findMany({
        where: { user_id: userId, tenant_id: tenantId },
        select: { branch_code: true }
      }),
      prisma.slotUserLink.findFirst({
        where: { user_id: userId, ended_at: null },
        select: {
          slot: {
            select: {
              slot_type: true,
              supervisee_agent_slot_ids: true,
              branch_code: true,
              branch_codes: true,
              territory: true,
              territories: true,
              warehouse_id: true,
              warehouse_ids: true,
              cash_desk_id: true,
              cash_desk_ids: true
            }
          }
        }
      })
    ]);

  const slot = activeSlotLink?.slot ?? null;
  const branchCodes = mergeBranchCodesForScope(
    branchLinks.map((b) => b.branch_code),
    slot
  );
  const territoryTerms = mergeTerritoryTermsForScope(u?.territory, slot);

  const territory_ids = uniquePositiveIds(territoryLinks.map((l) => l.territory_id));
  const teamSlotIds =
    slot?.slot_type === "supervisor"
      ? uniquePositiveIds(slot.supervisee_agent_slot_ids ?? [])
      : [];
  const [territoryStaffIds, branchStaffIds, termStaffIds, teamUserIds] = await Promise.all([
    listStaffIdsLinkedToTerritories(tenantId, territory_ids, { includeInactive }),
    listStaffIdsLinkedToBranches(tenantId, branchCodes, { includeInactive }),
    listStaffIdsByTerritoryTerms(tenantId, territoryTerms, { includeInactive }),
    teamSlotIds.length === 0
      ? Promise.resolve([] as number[])
      : prisma.slotUserLink
          .findMany({
            where: { slot_id: { in: teamSlotIds }, ended_at: null },
            select: { user_id: true }
          })
          .then((rows) => uniquePositiveIds(rows.map((r) => r.user_id)))
  ]);

  // Dostup + ish o‘rni: geo (hudud∪filial) birlashadi; hodim/jamoa belgilansa — kesishma.
  // SVR slotda jamoa bo‘sh ([]) — faqat geo; eski supervisor_user_id qoldiqlari «hamma» qilib yubormasin.
  const isSupervisorSlot = slot?.slot_type === "supervisor";
  const superviseeIds = uniquePositiveIds(
    isSupervisorSlot && teamSlotIds.length === 0
      ? []
      : [...supervisees.map((s) => s.id), ...teamUserIds]
  );
  const geoStaffIds = mergeGeoStaffIds(territoryStaffIds, branchStaffIds, termStaffIds);
  const hasGeoBinding =
    territory_ids.length > 0 || branchCodes.length > 0 || territoryTerms.length > 0;
  const bound_staff_ids = resolveStaffVisibilityByExplicitAndGeo({
    explicitStaffIds: superviseeIds,
    geoStaffIds,
    hasGeoBinding
  });

  const bound_agent_ids =
    bound_staff_ids.length === 0
      ? []
      : (
          await prisma.user.findMany({
            where: {
              tenant_id: tenantId,
              id: { in: bound_staff_ids },
              role: "agent",
              ...activeClause
            },
            select: { id: true }
          })
        ).map((a) => a.id);

  return {
    bound_agent_ids,
    bound_staff_ids,
    territory_ids,
    warehouse_ids: mergeWarehouseIdsForScope(
      warehouseLinks.map((l) => l.warehouse_id),
      slot
    ),
    cash_desk_ids: mergeCashDeskIdsForScope(
      cashLinks.map((l) => l.cash_desk_id),
      slot
    ),
    trade_direction_ids: u?.trade_direction_links.map((x) => x.trade_direction_id) ?? []
  };
}

/**
 * Admin — to‘liq katalog. Qolgan rollar — Dostup biriktirishlari.
 * Agent — faqat o‘zi.
 */
export async function enrichScopedReportActor(
  tenantId: number,
  actor: { userId: number | null; role: string }
): Promise<ScopedReportActor> {
  if (!actor.userId) {
    return { ...actor, ...EMPTY_ACCESS_SCOPE };
  }
  if (actorHasUnrestrictedDataScope(actor.role)) {
    return { ...actor, ...EMPTY_ACCESS_SCOPE };
  }
  const scope = await loadAccessDataScope(tenantId, actor.userId, { includeInactive: false });
  if (actor.role === "agent") {
    return {
      ...actor,
      ...scope,
      bound_agent_ids: [actor.userId],
      bound_staff_ids: [actor.userId]
    };
  }
  return { ...actor, ...scope };
}

export async function buildScopedAgentWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput> {
  if (!actor) return buildScopedAgentWhere(tenantId);
  const enriched = await enrichScopedReportActor(tenantId, actor);
  return buildScopedAgentWhere(tenantId, enriched);
}

export async function buildScopedStaffDirectoryWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput | null> {
  if (!actor?.userId) return null;
  if (actorHasUnrestrictedDataScope(actor.role)) return null;
  if (actor.role === "agent") return { id: actor.userId };
  const scope = await loadAccessDataScope(tenantId, actor.userId, { includeInactive: true });
  return buildScopedStaffDirectoryWhere({ ...actor, ...scope });
}

export async function buildScopedAgentDirectoryWhereForActor(
  tenantId: number,
  actor?: { userId: number | null; role: string }
): Promise<Prisma.UserWhereInput | null> {
  return buildScopedStaffDirectoryWhereForActor(tenantId, actor);
}

export async function assertClientAllowedForActor(
  tenantId: number,
  clientId: number,
  actor: { userId: number | null; role: string }
): Promise<void> {
  const enriched = await enrichScopedReportActor(tenantId, actor);
  const scopeWhere = buildClientAgentScopeWhere(enriched);
  if (scopeWhere === null) return;
  const found = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: tenantId, AND: [scopeWhere] },
    select: { id: true }
  });
  if (!found) {
    throw new Error("CLIENT_OUT_OF_SCOPE");
  }
}

export async function assertOrderAgentAllowedForActor(
  tenantId: number,
  agentId: number | null | undefined,
  actor: { userId: number | null; role: string }
): Promise<void> {
  const enriched = await enrichScopedReportActor(tenantId, actor);
  if (!isOrderAgentAllowedForActor(agentId, enriched)) {
    throw new Error("AGENT_OUT_OF_SCOPE");
  }
}
