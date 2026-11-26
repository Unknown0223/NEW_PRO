import { Prisma } from "@prisma/client";
import { buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { BonusesReportFilters } from "./bonuses-report.types";
import { bonusesDateExpr } from "./bonuses.dates";

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

/** Shared WHERE for bonuses FlatReport + universal-bonuses line dataset. */
export function buildBonusesReportWhere(
  tenantId: number,
  f: BonusesReportFilters,
  actor?: ReportActor
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`oi.is_bonus = true`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dateExpr = bonusesDateExpr(f.date_type);
  if (from) parts.push(Prisma.sql`${dateExpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dateExpr} <= ${to}`);
  if (f.statuses.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  else parts.push(Prisma.sql`o.status <> 'cancelled'`);
  if (f.agent_ids.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.category_ids.length) {
    parts.push(Prisma.sql`p.category_id IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.client_categories.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.territory_1_list.length) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list.length) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list.length) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(
      Prisma.sql`(
        p.name ILIKE ${pat}
        OR COALESCE(p.sku, '') ILIKE ${pat}
        OR COALESCE(c.name, '') ILIKE ${pat}
        OR COALESCE(ag.name, '') ILIKE ${pat}
        OR COALESCE(pc.name, '') ILIKE ${pat}
      )`
    );
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}
