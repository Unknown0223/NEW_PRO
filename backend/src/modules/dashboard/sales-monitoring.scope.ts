import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SalesMonitoringFilters } from "./sales-monitoring.types";

const ORDER_STATUS_WHITELIST = new Set([
  "new",
  "confirmed",
  "picking",
  "delivering",
  "delivered",
  "cancelled",
  "returned"
]);

export function csvToBranchCodes(input?: string): string[] {
  if (!input) return [];
  const set = new Set<string>();
  for (const p of input.split(",")) {
    const t = p.trim();
    if (t) set.add(t);
  }
  return [...set];
}

export function csvToStringList(input?: string): string[] {
  if (!input) return [];
  const set = new Set<string>();
  for (const p of input.split(",")) {
    const t = p.trim();
    if (t) set.add(t);
  }
  return [...set];
}

export function sanitizeOrderStatuses(raw: string[]): string[] {
  const out: string[] = [];
  for (const s of raw) {
    const t = s.trim();
    if (ORDER_STATUS_WHITELIST.has(t)) out.push(t);
  }
  return out;
}

function productLineFilterSql(f: SalesMonitoringFilters): Prisma.Sql {
  const skuRaw = f.sku_search?.trim().replace(/[%_\\]/g, "") ?? "";
  const hasSku = skuRaw.length > 0;
  const hasCat = f.category_ids.length > 0;
  if (!hasCat && !hasSku) return Prisma.empty;
  const term = `%${skuRaw}%`;
  if (hasCat && hasSku) {
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM order_items oi_f
      JOIN products p_f ON p_f.id = oi_f.product_id
      WHERE oi_f.order_id = o.id AND p_f.category_id IN (${Prisma.join(f.category_ids)})
        AND (p_f.sku ILIKE ${term} OR p_f.name ILIKE ${term})
    )`;
  }
  if (hasCat) {
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM order_items oi_f
      JOIN products p_f ON p_f.id = oi_f.product_id
      WHERE oi_f.order_id = o.id AND p_f.category_id IN (${Prisma.join(f.category_ids)})
    )`;
  }
  return Prisma.sql`AND EXISTS (
    SELECT 1 FROM order_items oi_f
    JOIN products p_f ON p_f.id = oi_f.product_id
    WHERE oi_f.order_id = o.id AND (p_f.sku ILIKE ${term} OR p_f.name ILIKE ${term})
  )`;
}

export function monthBoundsUtc(year: number, month: number): { from: Date; to: Date; fromYmd: string; toYmd: string } {
  const m = Math.min(12, Math.max(1, month));
  const y = Math.max(2000, Math.min(2100, year));
  const fromYmd = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const toYmd = `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  const from = new Date(`${fromYmd}T00:00:00.000Z`);
  const to = new Date(`${toYmd}T23:59:59.999Z`);
  return { from, to, fromYmd, toYmd };
}

function buildSalesTerritoryAliasClause(alias: string, terms: string[]): Prisma.Sql {
  if (terms.length === 0) return Prisma.empty;
  const vals = Prisma.join(terms.map((t) => Prisma.sql`${t}`));
  return Prisma.sql`AND (
    COALESCE(${Prisma.raw(`${alias}.region`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.city`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.district`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.zone`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.neighborhood`)}, '') IN (${vals})
  )`;
}

export async function resolveSalesTerritoryTerms(tenantId: number, territoryIds: number[]): Promise<string[]> {
  if (territoryIds.length === 0) return [];
  const rows = await prisma.territory.findMany({
    where: { tenant_id: tenantId, id: { in: territoryIds }, deleted_at: null },
    select: { name: true, code: true }
  });
  const set = new Set<string>();
  for (const r of rows) {
    const name = r.name?.trim();
    const code = r.code?.trim();
    if (name) set.add(name);
    if (code) set.add(code);
  }
  return [...set];
}

/** Asosiy savdo filtri: oy, agent/supervisor/filial/hudud; fakt — bekor va qaytmasiz (yoki faqat returned) */
export function monitoringSalesScope(
  tenantId: number,
  from: Date,
  to: Date,
  f: SalesMonitoringFilters,
  territoryTerms: string[],
  opts?: { returnedOrdersOnly?: boolean }
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`o.created_at >= ${from}`,
    Prisma.sql`o.created_at <= ${to}`
  ];
  if (opts?.returnedOrdersOnly) {
    parts.push(Prisma.sql`o.status = 'returned'`);
  } else if (f.order_statuses.length > 0) {
    parts.push(Prisma.sql`o.status IN (${Prisma.join(f.order_statuses.map((s) => Prisma.sql`${s}`))})`);
  } else {
    parts.push(Prisma.sql`o.status NOT IN ('cancelled', 'returned')`);
  }
  if (f.payment_method_refs.length > 0) {
    parts.push(
      Prisma.sql`COALESCE(TRIM(o.payment_method_ref), '') IN (${Prisma.join(
        f.payment_method_refs.map((s) => Prisma.sql`${s}`)
      )})`
    );
  }
  if (f.agent_ids.length > 0) parts.push(Prisma.sql`o.agent_id IN (${Prisma.join(f.agent_ids)})`);
  if (f.supervisor_ids.length > 0) parts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  if (f.branch_codes.length > 0) {
    parts.push(Prisma.sql`COALESCE(TRIM(u.branch), '') IN (${Prisma.join(f.branch_codes)})`);
  }
  if (f.territory_1_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.zone, '')) IN (${Prisma.join(f.territory_1_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_2_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.region, '')) IN (${Prisma.join(f.territory_2_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_3_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.city, '')) IN (${Prisma.join(f.territory_3_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  const base = Prisma.join(parts, " AND ");
  const territoryClause = buildSalesTerritoryAliasClause("c", territoryTerms);
  const productLine = productLineFilterSql(f);
  return Prisma.sql`${base} ${territoryClause} ${productLine}`;
}

/** Oy va filtr bo‘yicha zakazlar (barcha statuslar — status bo‘yicha taqqoslash uchun) */
export function monitoringOrdersScopeAllStatuses(
  tenantId: number,
  from: Date,
  to: Date,
  f: SalesMonitoringFilters,
  territoryTerms: string[]
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`o.created_at >= ${from}`,
    Prisma.sql`o.created_at <= ${to}`
  ];
  if (f.order_statuses.length > 0) {
    parts.push(Prisma.sql`o.status IN (${Prisma.join(f.order_statuses.map((s) => Prisma.sql`${s}`))})`);
  }
  if (f.payment_method_refs.length > 0) {
    parts.push(
      Prisma.sql`COALESCE(TRIM(o.payment_method_ref), '') IN (${Prisma.join(
        f.payment_method_refs.map((s) => Prisma.sql`${s}`)
      )})`
    );
  }
  if (f.agent_ids.length > 0) parts.push(Prisma.sql`o.agent_id IN (${Prisma.join(f.agent_ids)})`);
  if (f.supervisor_ids.length > 0) parts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  if (f.branch_codes.length > 0) {
    parts.push(Prisma.sql`COALESCE(TRIM(u.branch), '') IN (${Prisma.join(f.branch_codes)})`);
  }
  if (f.territory_1_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.zone, '')) IN (${Prisma.join(f.territory_1_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_2_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.region, '')) IN (${Prisma.join(f.territory_2_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_3_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.city, '')) IN (${Prisma.join(f.territory_3_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  const base = Prisma.join(parts, " AND ");
  const territoryClause = buildSalesTerritoryAliasClause("c", territoryTerms);
  const productLine = productLineFilterSql(f);
  return Prisma.sql`${base} ${territoryClause} ${productLine}`;
}

export function monitoringAllClientsScope(
  tenantId: number,
  f: SalesMonitoringFilters,
  territoryTerms: string[]
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`caa.tenant_id = ${tenantId}`];
  if (f.agent_ids.length > 0) parts.push(Prisma.sql`caa.agent_id IN (${Prisma.join(f.agent_ids)})`);
  if (f.supervisor_ids.length > 0) parts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  if (f.branch_codes.length > 0) {
    parts.push(Prisma.sql`COALESCE(TRIM(u.branch), '') IN (${Prisma.join(f.branch_codes)})`);
  }
  if (f.territory_1_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.zone, '')) IN (${Prisma.join(f.territory_1_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_2_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.region, '')) IN (${Prisma.join(f.territory_2_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_3_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.city, '')) IN (${Prisma.join(f.territory_3_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  const base = Prisma.join(parts, " AND ");
  const territoryClause = buildSalesTerritoryAliasClause("c", territoryTerms);
  return Prisma.sql`${base} ${territoryClause}`;
}
