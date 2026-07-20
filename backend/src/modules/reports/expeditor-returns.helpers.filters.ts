import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { buildScopedAgentExistsSql, type ScopedReportActor } from "../access/access-agent-scope";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { ExpeditorReturnsFilters, ExpeditorReturnsUnitMode } from "./expeditor-returns.types";

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

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

export const KNOWN_ORDER_TYPES = [...ORDER_TYPES] as string[];

export function orderTypeLabelRu(id: string): string {
  const k = id as keyof typeof ORDER_TYPE_LABELS;
  return ORDER_TYPE_LABELS[k] ?? id;
}

export const ORDER_STATUS_LABEL_RU: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  picking: "Комплектация",
  delivering: "Отгружен",
  delivered: "Доставлен",
  returned: "Возврат",
  cancelled: "Отменён"
};

export const STATUS_CTE = Prisma.sql`
  status_logs AS (
    SELECT
      sl.order_id,
      MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
      MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
    FROM order_status_logs sl
    GROUP BY sl.order_id
  )`;

export function dateFilterExpr(f: ExpeditorReturnsFilters): Prisma.Sql {
  if (f.date_type === "shipped_date") {
    return Prisma.sql`COALESCE(sl.shipped_at, o.updated_at)`;
  }
  return Prisma.sql`o.created_at`;
}

export function buildExpeditorOrderWhereSql(
  tenantId: number,
  f: ExpeditorReturnsFilters,
  actor?: ReportActor | ScopedReportActor
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`o.tenant_id = ${tenantId}`, Prisma.sql`o.order_type = 'order'`];

  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dexpr = dateFilterExpr(f);
  if (from) parts.push(Prisma.sql`${dexpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dexpr} <= ${to}`);

  if (f.application_type === "returns_only") {
    parts.push(Prisma.sql`(
      o.status IN ('cancelled','returned')
      OR EXISTS (
        SELECT 1 FROM sales_returns sr0
        WHERE sr0.tenant_id = o.tenant_id
          AND sr0.order_id = o.id
          AND sr0.status = 'posted'
      )
    )`);
  }

  if (f.statuses && f.statuses.length > 0) {
    parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  }

  if (f.agent_ids && f.agent_ids.length > 0) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }

  if (f.expeditor_ids && f.expeditor_ids.length > 0) {
    parts.push(Prisma.sql`o.expeditor_user_id IN (${Prisma.join(f.expeditor_ids)})`);
  }

  if (f.payment_methods && f.payment_methods.length > 0) {
    parts.push(
      Prisma.sql`(
        COALESCE(o.payment_method_ref,'') IN (${sqlInStrings(f.payment_methods)})
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(o.payment_method_ref, ''), ',') AS pm(v)
          WHERE btrim(pm.v) IN (${sqlInStrings(f.payment_methods)})
        )
      )`
    );
  }

  if (f.warehouse_id != null && Number.isFinite(f.warehouse_id)) {
    parts.push(Prisma.sql`o.warehouse_id = ${f.warehouse_id}`);
  }

  if (f.category_ids && f.category_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM order_items oi2
        JOIN products p2 ON p2.id = oi2.product_id AND p2.tenant_id = ${tenantId}
        WHERE oi2.order_id = o.id AND p2.category_id IN (${Prisma.join(f.category_ids)})
      )`
    );
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

  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    const idTry = Number.parseInt(search, 10);
    if (Number.isFinite(idTry) && String(idTry) === search) {
      parts.push(Prisma.sql`(o.id = ${idTry} OR o.number ILIKE ${pat} OR c.name ILIKE ${pat})`);
    } else {
      parts.push(Prisma.sql`(o.number ILIKE ${pat} OR c.name ILIKE ${pat})`);
    }
  }

  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }

  return Prisma.join(parts, " AND ");
}

export function sortOrdersSql(sortBy: ExpeditorReturnsFilters["sort_by"]): Prisma.Sql {
  if (sortBy === "order_date") return Prisma.sql`created_at DESC, id DESC`;
  if (sortBy === "client_name") return Prisma.sql`client_name ASC, id DESC`;
  if (sortBy === "return_qty") return Prisma.sql`return_qty_effective DESC NULLS LAST, id DESC`;
  return Prisma.sql`id DESC`;
}

export function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

