import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ClientSales4Filters, ReportActor } from "./client-sales-4.types";
import { buildScopedAgentExistsSql } from "../access/access-agent-scope";

export function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateEnd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function intList(v?: string): number[] {
  return (v ?? "")
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x) && x > 0);
}

export function strList(v?: string): string[] {
  return (v ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Hujjat turlari — `orders.order_type` bilan mos */
export const KNOWN_ORDER_TYPES = ["order", "return", "exchange", "return_by_order", "partial_return"] as const;

export function parseOrderTypesParam(v?: string): string[] {
  const allow = new Set<string>(KNOWN_ORDER_TYPES);
  return strList(v).filter((x) => allow.has(x));
}

export function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

export function productFilterSql4(f: ClientSales4Filters): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (f.category_ids && f.category_ids.length > 0) {
    parts.push(Prisma.sql`p.category_id IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.brand_ids && f.brand_ids.length > 0) {
    parts.push(Prisma.sql`p.brand_id IN (${Prisma.join(f.brand_ids)})`);
  }
  if (parts.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, " AND ")}`;
}

export function buildOrderWhereSql4(tenantId: number, f: ClientSales4Filters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`o.tenant_id = ${tenantId}`];

  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dateExpr = Prisma.sql`o.created_at`;
  if (from) parts.push(Prisma.sql`${dateExpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dateExpr} <= ${to}`);

  if (f.statuses && f.statuses.length > 0) {
    parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  } else {
    parts.push(Prisma.sql`o.status <> 'cancelled'`);
  }

  if (f.order_types && f.order_types.length > 0) {
    parts.push(Prisma.sql`o.order_type IN (${sqlInStrings(f.order_types)})`);
  } else {
    parts.push(Prisma.sql`o.order_type = 'order'`);
  }

  if (f.agent_ids && f.agent_ids.length > 0) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }

  if (f.client_categories && f.client_categories.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }

  if (f.territory_1_list && f.territory_1_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list && f.territory_2_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list && f.territory_3_list.length > 0) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }

  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    const idTry = Number.parseInt(search, 10);
    if (Number.isFinite(idTry) && String(idTry) === search.trim()) {
      parts.push(
        Prisma.sql`(
          c.name ILIKE ${pat}
          OR c.id = ${idTry}
          OR EXISTS (
            SELECT 1 FROM users au
            WHERE au.id = COALESCE(o.agent_id, c.agent_id)
              AND au.tenant_id = ${tenantId}
              AND (au.code ILIKE ${pat} OR au.name ILIKE ${pat})
          )
        )`
      );
    } else {
      parts.push(
        Prisma.sql`(
          c.name ILIKE ${pat}
          OR EXISTS (
            SELECT 1 FROM users au
            WHERE au.id = COALESCE(o.agent_id, c.agent_id)
              AND au.tenant_id = ${tenantId}
              AND (au.code ILIKE ${pat} OR au.name ILIKE ${pat})
          )
        )`
      );
    }
  }

  if (f.consignment === "yes") {
    parts.push(
      Prisma.sql`(
        o.is_consignment = true OR EXISTS (
          SELECT 1 FROM users au
          WHERE au.id = COALESCE(o.agent_id, c.agent_id)
            AND au.tenant_id = ${tenantId}
            AND au.consignment = true
        )
      )`
    );
  } else if (f.consignment === "no") {
    parts.push(
      Prisma.sql`(
        o.is_consignment = false AND NOT EXISTS (
          SELECT 1 FROM users au
          WHERE au.id = COALESCE(o.agent_id, c.agent_id)
            AND au.tenant_id = ${tenantId}
            AND au.consignment = true
        )
      )`
    );
  }

  if (f.trade_direction_ids && f.trade_direction_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users au
        WHERE au.id = COALESCE(o.agent_id, c.agent_id)
          AND au.tenant_id = ${tenantId}
          AND au.trade_direction_id IN (${Prisma.join(f.trade_direction_ids)})
      )`
    );
  }

  if (actor) {
    parts.push(
      buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor)
    );
  }

  return Prisma.join(parts, " AND ");
}
