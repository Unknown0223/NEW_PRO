import { Prisma } from "@prisma/client";

/** Foydalanuvchi uchun Dostup ko‘rinish cheklovi (hodim / hudud / ombor / kassa). */
export type AccessAgentScope = {
  bound_agent_ids: number[];
  bound_staff_ids: number[];
  territory_ids: number[];
  warehouse_ids: number[];
  cash_desk_ids: number[];
  trade_direction_ids: number[];
};

export type ScopedReportActor = {
  userId: number | null;
  role: string;
  bound_agent_ids?: number[];
  bound_staff_ids?: number[];
  territory_ids?: number[];
  warehouse_ids?: number[];
  cash_desk_ids?: number[];
  trade_direction_ids?: number[];
};

export const EMPTY_ACCESS_SCOPE: AccessAgentScope = {
  bound_agent_ids: [],
  bound_staff_ids: [],
  territory_ids: [],
  warehouse_ids: [],
  cash_desk_ids: [],
  trade_direction_ids: []
};

export function uniquePositiveIds(ids: number[]): number[] {
  return [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
}

/** Faqat admin — Dostup scope cheklovisiz. */
export function actorHasUnrestrictedDataScope(role: string): boolean {
  return role === "admin";
}

/**
 * Dostup: hodimlar ∩ hudud.
 * — hech narsa belgilanmagan → []
 * — faqat hodimlar → shu hodimlar
 * — faqat hudud → shu hududdagi hodimlar
 * — ikkalasi → kesishma (begona hudud hodimlari ko‘rinmasin)
 */
export function resolveVisibleStaffIds(
  superviseeIds: number[],
  territoryIds: number[],
  territoryStaffIds: number[]
): number[] {
  return resolveStaffVisibilityByExplicitAndGeo({
    explicitStaffIds: superviseeIds,
    geoStaffIds: territoryStaffIds,
    hasGeoBinding: uniquePositiveIds(territoryIds).length > 0
  });
}

/**
 * Umumiy qoida (Dostup + ish o‘rni filial/hudud):
 * — faqat geo → geo dagi barcha hodimlar (va ularning savdolari)
 * — faqat belgilangan hodimlar → shu hodimlar
 * — geo + hodim → faqat geo ichidagi belgilangan hodimlar
 * — geo belgilangan lekin geo topilmasa → explicit saqlanadi (jamoa nollanmasin)
 */
export function resolveStaffVisibilityByExplicitAndGeo(input: {
  explicitStaffIds: number[];
  geoStaffIds: number[];
  hasGeoBinding: boolean;
}): number[] {
  const explicit = uniquePositiveIds(input.explicitStaffIds);
  const geo = uniquePositiveIds(input.geoStaffIds);
  const hasE = explicit.length > 0;
  const hasG = input.hasGeoBinding;
  if (!hasE && !hasG) return [];
  if (hasE && !hasG) return explicit;
  if (!hasE && hasG) return geo;
  // Geo resolve bo‘sh — kesishma o‘rniga jamoani saqlaymiz (string mismatch / sync kechikishi)
  if (geo.length === 0) return explicit;
  const allowed = new Set(geo);
  return explicit.filter((id) => allowed.has(id));
}

export type StaffVisibilityDimension = {
  /** Foydalanuvchiga shu o‘lcham bo‘yicha biror narsa biriktirilganmi (hudud / filial / hodimlar). */
  bound: boolean;
  staffIds: number[];
};

/**
 * Dostup: har bir biriktirilgan o‘lcham — filtr, hammasi kesishadi.
 * — hech narsa biriktirilmagan → []
 * — faqat hudud (yoki faqat filial) → shu joydagi barcha hodimlar
 * — filial + 1 hodim → faqat shu hodim (agar u filialda bo‘lsa)
 * Biriktirilgan, lekin birorta hodim topilmagan geo o‘lcham (nom mos kelmasligi) natijani nollamaydi.
 */
export function resolveStaffVisibilityByDimensions(dims: StaffVisibilityDimension[]): number[] {
  const effective = dims.filter((d) => d.bound && uniquePositiveIds(d.staffIds).length > 0);
  if (effective.length === 0) return [];
  let result = uniquePositiveIds(effective[0]!.staffIds);
  for (const d of effective.slice(1)) {
    const allowed = new Set(d.staffIds);
    result = result.filter((id) => allowed.has(id));
  }
  return result;
}

/**
 * `null` — cheklov yo‘q (admin).
 * `[]` — hech narsa ko‘rinmasin.
 */
export function resolveAllowedAgentIdsForActor(actor: ScopedReportActor): number[] | null {
  if (!actor.userId || actorHasUnrestrictedDataScope(actor.role)) return null;
  if (actor.role === "agent") return [actor.userId];
  return uniquePositiveIds(actor.bound_agent_ids ?? []);
}

export function intersectRequestedAgentIds(
  requested: number[] | undefined,
  actor: ScopedReportActor
): { agentIds: number[]; restricted: boolean } {
  const allowed = resolveAllowedAgentIdsForActor(actor);
  const req = uniquePositiveIds(requested ?? []);
  if (allowed === null) {
    return { agentIds: req, restricted: false };
  }
  if (req.length > 0) {
    return { agentIds: req.filter((id) => allowed.includes(id)), restricted: true };
  }
  return { agentIds: allowed, restricted: true };
}

export function buildClientAgentScopeWhere(actor: ScopedReportActor): Prisma.ClientWhereInput | null {
  const allowed = resolveAllowedAgentIdsForActor(actor);
  if (allowed === null) return null;
  if (allowed.length === 0) return { id: { in: [] } };
  return {
    OR: [{ agent_id: { in: allowed } }, { agent_assignments: { some: { agent_id: { in: allowed } } } }]
  };
}

/** Buyurtmalar: belgilangan agentlar yoki belgilangan omborlar. Hech narsa yo‘q → bo‘sh. */
export function buildOrderAgentScopeWhere(actor: ScopedReportActor): Prisma.OrderWhereInput | null {
  if (!actor.userId || actorHasUnrestrictedDataScope(actor.role)) return null;
  if (actor.role === "agent") {
    return { agent_id: actor.userId };
  }
  const agents = uniquePositiveIds(actor.bound_agent_ids ?? []);
  const warehouses = uniquePositiveIds(actor.warehouse_ids ?? []);
  const or: Prisma.OrderWhereInput[] = [];
  if (agents.length > 0) or.push({ agent_id: { in: agents } });
  if (warehouses.length > 0) or.push({ warehouse_id: { in: warehouses } });
  if (or.length === 0) return { agent_id: { in: [] } };
  if (or.length === 1) return or[0]!;
  return { OR: or };
}

export function isOrderAgentAllowedForActor(
  agentId: number | null | undefined,
  actor: ScopedReportActor
): boolean {
  if (!actor.userId || actorHasUnrestrictedDataScope(actor.role)) return true;
  // Agent va ekspeditor o‘z maydon yozuvlari (vizit/GPS) uchun o‘zini ruxsat etadi.
  if (actor.role === "agent" || actor.role === "expeditor") {
    return agentId != null && agentId === actor.userId;
  }
  if (agentId == null || agentId < 1) return false;
  const bound = uniquePositiveIds(actor.bound_agent_ids ?? []);
  return bound.includes(agentId);
}

export function buildScopedAgentWhere(
  tenantId: number,
  actor?: ScopedReportActor
): Prisma.UserWhereInput {
  if (actor?.role === "agent" && actor.userId) {
    return { tenant_id: tenantId, id: actor.userId, is_active: true };
  }
  if (actor?.userId && !actorHasUnrestrictedDataScope(actor.role)) {
    const bound = uniquePositiveIds(actor.bound_agent_ids ?? []);
    return { tenant_id: tenantId, role: "agent", id: { in: bound }, is_active: true };
  }
  return { tenant_id: tenantId, role: "agent", is_active: true };
}

/**
 * Staff katalogi: belgilangan hodimlar (har qanday rol).
 * `null` — to‘liq katalog (admin).
 */
export function buildScopedStaffDirectoryWhere(
  actor?: ScopedReportActor
): Prisma.UserWhereInput | null {
  if (!actor?.userId) return null;
  if (actorHasUnrestrictedDataScope(actor.role)) return null;
  if (actor.role === "agent") {
    return { id: actor.userId };
  }
  const bound = uniquePositiveIds(actor.bound_staff_ids ?? actor.bound_agent_ids ?? []);
  return { id: { in: bound } };
}

/** Agent katalogi — staff directory bilan bir xil (listStaff role filtri qo‘shadi). */
export function buildScopedAgentDirectoryWhere(
  _tenantId: number,
  actor?: ScopedReportActor
): Prisma.UserWhereInput | null {
  return buildScopedStaffDirectoryWhere(actor);
}

export function buildScopedAgentExistsSql(
  tenantId: number,
  agentIdExpr: Prisma.Sql,
  actor?: ScopedReportActor
): Prisma.Sql {
  if (actor?.role === "agent" && actor.userId) {
    return Prisma.sql`${agentIdExpr} = ${actor.userId}`;
  }
  if (!actor?.userId || actorHasUnrestrictedDataScope(actor.role)) {
    return Prisma.sql`TRUE`;
  }
  const bound = uniquePositiveIds(actor.bound_agent_ids ?? []);
  if (bound.length > 0) {
    return Prisma.sql`${agentIdExpr} IN (${Prisma.join(bound)})`;
  }
  return Prisma.sql`FALSE`;
}

/**
 * To‘lovlar: belgilangan agentlar ∪ kassalar ∪ omborlar.
 * Hech narsa yo‘q → bo‘sh qator.
 * `null` — cheklov yo‘q.
 */
export function buildActorPaymentGrantOr(actor: ScopedReportActor): Prisma.PaymentWhereInput | null {
  if (!actor.userId || actorHasUnrestrictedDataScope(actor.role)) return null;
  if (actor.role === "agent") {
    return {
      OR: [
        { client: { agent_id: actor.userId } },
        { client: { agent_assignments: { some: { agent_id: actor.userId } } } }
      ]
    };
  }
  const agents = uniquePositiveIds(actor.bound_agent_ids ?? []);
  const desks = uniquePositiveIds(actor.cash_desk_ids ?? []);
  const warehouses = uniquePositiveIds(actor.warehouse_ids ?? []);
  const or: Prisma.PaymentWhereInput[] = [];
  if (agents.length > 0) {
    or.push({
      client: {
        OR: [
          { agent_id: { in: agents } },
          { agent_assignments: { some: { agent_id: { in: agents } } } }
        ]
      }
    });
  }
  if (desks.length > 0) or.push({ cash_desk_id: { in: desks } });
  if (warehouses.length > 0) or.push({ order: { warehouse_id: { in: warehouses } } });
  if (or.length === 0) return { id: { in: [] } };
  if (or.length === 1) return or[0]!;
  return { OR: or };
}

/** Dashboard raw SQL: bo‘sh IN () o‘rniga hech narsa mos kelmasin. */
export function agentIdsForRestrictedSql(agentIds: number[]): number[] {
  const ids = uniquePositiveIds(agentIds);
  return ids.length > 0 ? ids : [0];
}
