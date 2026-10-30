import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "./access-agent-scope";
import { mergeTerritoryTermsForScope } from "./access-scope-from-slot";
import {
  actorHasUnrestrictedDataScope,
  uniquePositiveIds,
  type ScopedReportActor
} from "./access-staff-scope";
import type { TerritoryNode, TerritoryRow } from "../reports/territory-nodes";

export type FilterOptionsScope = {
  unrestricted: boolean;
  actor: ScopedReportActor;
  /** null = cheklov yo‘q; [] = hech narsa */
  warehouseIds: number[] | null;
  cashDeskIds: number[] | null;
  /** null = cheklov yo‘q; [] = hech narsa (hudud bog‘lanmagan) */
  territoryTerms: string[] | null;
  boundStaffIds: number[] | null;
};

/** Web filtr opsiyalari — Dostup + ish o‘rni bo‘yicha. */
export async function resolveFilterOptionsScope(
  tenantId: number,
  actor?: { userId: number | null; role: string } | null
): Promise<FilterOptionsScope> {
  if (!actor?.userId) {
    return {
      unrestricted: true,
      actor: { userId: null, role: actor?.role ?? "" },
      warehouseIds: null,
      cashDeskIds: null,
      territoryTerms: null,
      boundStaffIds: null
    };
  }
  if (actorHasUnrestrictedDataScope(actor.role)) {
    return {
      unrestricted: true,
      actor: { ...actor },
      warehouseIds: null,
      cashDeskIds: null,
      territoryTerms: null,
      boundStaffIds: null
    };
  }

  const enriched = await enrichScopedReportActor(tenantId, actor);
  const territoryTerms = await resolveActorTerritoryFilterTerms(tenantId, enriched);

  return {
    unrestricted: false,
    actor: enriched,
    warehouseIds: uniquePositiveIds(enriched.warehouse_ids ?? []),
    cashDeskIds: uniquePositiveIds(enriched.cash_desk_ids ?? []),
    territoryTerms,
    boundStaffIds: uniquePositiveIds(enriched.bound_staff_ids ?? enriched.bound_agent_ids ?? [])
  };
}

async function resolveActorTerritoryFilterTerms(
  tenantId: number,
  actor: ScopedReportActor
): Promise<string[]> {
  if (!actor.userId) return [];
  const territoryIds = uniquePositiveIds(actor.territory_ids ?? []);
  const [u, slotLink, territories] = await Promise.all([
    prisma.user.findFirst({
      where: { id: actor.userId, tenant_id: tenantId },
      select: { territory: true }
    }),
    prisma.slotUserLink.findFirst({
      where: { user_id: actor.userId, ended_at: null },
      select: {
        slot: { select: { territory: true, territories: true } }
      }
    }),
    territoryIds.length > 0
      ? prisma.territory.findMany({
          where: { tenant_id: tenantId, id: { in: territoryIds }, deleted_at: null },
          select: { name: true, code: true }
        })
      : Promise.resolve([] as Array<{ name: string; code: string | null }>)
  ]);

  // Zona segmenti (FV / SOUTH-WEST) termga kirmasin — aks holda butun zona shaharlari sizib chiqadi.
  const fromLinks = territories
    .map((t) => t.name?.trim())
    .filter((n): n is string => Boolean(n));
  const terms = new Set<string>(
    mergeTerritoryTermsForScope(u?.territory, {
      territory: slotLink?.slot?.territory,
      territories: [...(slotLink?.slot?.territories ?? []), ...fromLinks]
    })
  );
  for (const t of territories) {
    const code = t.code?.trim();
    if (code && code.length >= 2) terms.add(code);
  }
  return [...terms];
}

/** Staff (agent/SVR/expeditor/…) — faqat bound. */
export function staffWhereForFilterOptions(
  tenantId: number,
  scope: FilterOptionsScope,
  role?: string | string[]
): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = {
    tenant_id: tenantId,
    is_active: true,
    ...(role
      ? { role: Array.isArray(role) ? { in: role } : role }
      : {})
  };
  if (scope.unrestricted || scope.boundStaffIds === null) return base;
  return { ...base, id: { in: scope.boundStaffIds } };
}

export function warehouseWhereForFilterOptions(
  tenantId: number,
  scope: FilterOptionsScope
): Prisma.WarehouseWhereInput {
  const base: Prisma.WarehouseWhereInput = { tenant_id: tenantId, is_active: true };
  if (scope.unrestricted || scope.warehouseIds === null) return base;
  return { ...base, id: { in: scope.warehouseIds } };
}

export function cashDeskWhereForFilterOptions(
  tenantId: number,
  scope: FilterOptionsScope
): Prisma.CashDeskWhereInput {
  const base: Prisma.CashDeskWhereInput = { tenant_id: tenantId, is_active: true };
  if (scope.unrestricted || scope.cashDeskIds === null) return base;
  return { ...base, id: { in: scope.cashDeskIds } };
}

export function filterTerritoryRowsByTerms(
  rows: TerritoryRow[],
  terms: string[] | null
): TerritoryRow[] {
  if (terms === null) return rows;
  if (terms.length === 0) return [];
  return rows.filter((row) => {
    // Avvalo oblast/shahar — zona yolg‘iz match (SOUTH-WEST) begona shaharlarni tortmasin.
    const region = (row.t2 ?? "").trim();
    const city = (row.t3 ?? "").trim();
    if (region && textMatchesTerritoryTerms(region, terms)) return true;
    if (city && textMatchesTerritoryTerms(city, terms)) return true;
    return false;
  });
}

/**
 * Hudud solishtirish: aniq yoki segment/contains.
 * Qisqa umumiy so‘zlar (viloyati) bo‘yicha begona oblastlar sizib chiqmasin.
 */
export function textMatchesTerritoryTerms(value: string | null | undefined, terms: string[] | null): boolean {
  if (terms === null) return true;
  if (terms.length === 0) return false;
  const v = (value ?? "").trim();
  if (!v) return false;
  const vl = v.toLowerCase();
  const vSegments = vl.split(/[|/·•\s]+/).filter((s) => s.length >= 2);

  for (const raw of terms) {
    const t = raw.trim();
    if (!t) continue;
    const tl = t.toLowerCase();
    if (GENERIC_MATCH_SKIP.has(tl)) continue;
    if (vl === tl) return true;
    if (vl.includes(tl) && tl.length >= 4) return true;
    // Term ichida qiymat — faqat qiymat yetarlicha uzun bo‘lsa (Andijon ⊄ Xorazm)
    if (tl.includes(vl) && vl.length >= 5) return true;
    const tSegments = tl.split(/[|/·•\s]+/).filter((s) => s.length >= 2 && !GENERIC_MATCH_SKIP.has(s));
    if (tSegments.some((ts) => ts.length >= 4 && (vSegments.includes(ts) || vl.includes(ts)))) {
      return true;
    }
  }
  return false;
}

const GENERIC_MATCH_SKIP = new Set(
  [
    "viloyati",
    "viloyat",
    "область",
    "oblast",
    "region",
    "zona",
    "zone",
    "shahar",
    "город",
    "city",
    "tuman",
    "tumani",
    "district",
    "south",
    "west",
    "east",
    "north",
    "south west",
    "south-west",
    "north west",
    "north-east"
  ].map((s) => s.toLowerCase())
);

/** territory_nodes daraxtini Dostup terminlari bilan kesish. */
export function pruneTerritoryNodesByTerms(
  nodes: TerritoryNode[],
  terms: string[] | null
): TerritoryNode[] {
  if (terms === null) return nodes;
  if (terms.length === 0) return [];

  const match = (name: string) => textMatchesTerritoryTerms(name, terms);

  function walk(list: TerritoryNode[]): TerritoryNode[] {
    const out: TerritoryNode[] = [];
    for (const node of list) {
      if (node.active === false) continue;
      const name = node.name?.trim() ?? "";
      if (!name) continue;
      const rawChildren = node.children ?? [];
      const children = walk(rawChildren);
      const selfMatch = match(name);
      if (selfMatch) {
        // Ota mos — bolalarni ham kesamiz; hech biri mos kelmasa (zona-level) barcha bolalarni saqlaymiz.
        out.push({
          ...node,
          name,
          children: children.length > 0 || rawChildren.length === 0 ? children : rawChildren
        });
      } else if (children.length > 0) {
        out.push({ ...node, name, children });
      }
    }
    return out;
  }
  return walk(nodes);
}

export function filterStringListByTerms(values: string[], terms: string[] | null): string[] {
  if (terms === null) return values;
  if (terms.length === 0) return [];
  return values.filter((v) => textMatchesTerritoryTerms(v, terms));
}
