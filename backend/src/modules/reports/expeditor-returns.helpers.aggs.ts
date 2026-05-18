import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { mergeTerritoryFilterOptions } from "./territory-nodes";
import type { ExpeditorReturnsFilters, ExpeditorReturnsUnitMode } from "./expeditor-returns.types";
import {
  buildExpeditorOrderWhereSql,
  decStr,
  ORDER_STATUS_LABEL_RU,
  orderTypeLabelRu,
  STATUS_CTE
} from "./expeditor-returns.helpers.filters";

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
export function ordersCoreCte(tenantId: number, f: ExpeditorReturnsFilters, actor?: ReportActor): Prisma.Sql {
  const whereSql = buildExpeditorOrderWhereSql(tenantId, f, actor);
  return Prisma.sql`
    ${STATUS_CTE},
    line_tot AS (
      SELECT
        oi.order_id,
        SUM(CASE
          WHEN oi.is_bonus = false AND (oi.exchange_line_kind IS NULL OR oi.exchange_line_kind <> 'minus')
            THEN oi.qty ELSE 0::numeric
        END)::numeric(15,3) AS qty_ordered,
        SUM(CASE WHEN oi.is_bonus = true THEN oi.qty ELSE 0::numeric END)::numeric(15,3) AS qty_bonus_ordered
      FROM order_items oi
      GROUP BY oi.order_id
    ),
    sr_qty AS (
      SELECT
        sr.order_id,
        SUM(srl.qty)::numeric(15,3) AS return_qty,
        SUM(COALESCE(srl.bonus_qty, 0::numeric))::numeric(15,3) AS return_bonus_qty
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.return_id = sr.id
      WHERE sr.tenant_id = ${tenantId}
        AND sr.status = 'posted'
        AND sr.order_id IS NOT NULL
      GROUP BY sr.order_id
    ),
    sr_refund AS (
      SELECT
        sr.order_id,
        SUM(COALESCE(sr.refund_amount, 0::numeric))::numeric(15,2) AS refund_sum,
        string_agg(DISTINCT NULLIF(btrim(sr.refusal_reason_ref), ''), '; ') AS refusal_reasons
      FROM sales_returns sr
      WHERE sr.tenant_id = ${tenantId}
        AND sr.status = 'posted'
        AND sr.order_id IS NOT NULL
      GROUP BY sr.order_id
    ),
    base_orders AS (
      SELECT
        o.id,
        o.number,
        o.order_type,
        o.status,
        o.created_at,
        o.updated_at,
        o.total_sum,
        o.bonus_sum,
        o.request_type_ref,
        c.name AS client_name,
        CASE
          WHEN ag.id IS NOT NULL THEN
            concat_ws(' ', concat('(', ag.id::text, ')'), NULLIF(btrim(ag.code), ''), NULLIF(btrim(ag.name), ''))
          ELSE NULL
        END AS agent_label,
        CASE
          WHEN ex.id IS NOT NULL THEN concat_ws(' ', NULLIF(btrim(ex.code), ''), NULLIF(btrim(ex.name), ''))
          ELSE NULL
        END AS expeditor_label,
        sl.shipped_at,
        sl.delivered_at,
        COALESCE(lt.qty_ordered, 0::numeric) AS qty_ordered,
        COALESCE(lt.qty_bonus_ordered, 0::numeric) AS qty_bonus_ordered,
        COALESCE(sq.return_qty, CASE WHEN o.status IN ('cancelled', 'returned') THEN COALESCE(lt.qty_ordered, 0::numeric) ELSE 0::numeric END)::numeric(15,3) AS return_qty_effective,
        COALESCE(sq.return_bonus_qty, CASE WHEN o.status IN ('cancelled', 'returned') THEN COALESCE(lt.qty_bonus_ordered, 0::numeric) ELSE 0::numeric END)::numeric(15,3) AS return_bonus_effective,
        COALESCE(
          rf.refund_sum,
          CASE WHEN o.status IN ('cancelled', 'returned') AND (sq.return_qty IS NULL OR sq.return_qty = 0::numeric)
            THEN o.total_sum
            ELSE 0::numeric
          END
        )::numeric(15,2) AS refund_sum,
        rf.refusal_reasons,
        GREATEST(
          0::numeric,
          COALESCE(lt.qty_ordered, 0::numeric) - COALESCE(sq.return_qty, CASE WHEN o.status IN ('cancelled', 'returned') THEN COALESCE(lt.qty_ordered, 0::numeric) ELSE 0::numeric END)
        )::numeric(15,3) AS delivered_qty,
        0::numeric(15,3) AS extra_order_qty,
        0::numeric(15,3) AS bonus_delivery_qty,
        COALESCE(o.bonus_sum, 0::numeric) AS bonus_delivery_sum
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = ${tenantId}
      LEFT JOIN users ex ON ex.id = o.expeditor_user_id AND ex.tenant_id = ${tenantId}
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      LEFT JOIN line_tot lt ON lt.order_id = o.id
      LEFT JOIN sr_qty sq ON sq.order_id = o.id
      LEFT JOIN sr_refund rf ON rf.order_id = o.id
      WHERE ${whereSql}
    )
  `;
}

import type { OrderRowRaw } from "./expeditor-returns.types";

export function mapOrderRow(r: OrderRowRaw, idx: number, page: number, limit: number) {
  const sumAfter = r.total_sum.sub(r.refund_sum);
  return {
    row_number: (page - 1) * limit + idx + 1,
    order_id: r.id,
    order_number: r.number,
    order_type: r.order_type,
    order_type_label: orderTypeLabelRu(r.order_type),
    status: r.status,
    status_label: ORDER_STATUS_LABEL_RU[r.status] ?? r.status,
    order_date: r.created_at.toISOString(),
    created_at: r.created_at.toISOString(),
    shipped_at: r.shipped_at ? r.shipped_at.toISOString() : null,
    delivered_at: r.delivered_at ? r.delivered_at.toISOString() : null,
    updated_at: r.updated_at.toISOString(),
    client_name: r.client_name,
    agent_label: r.agent_label ?? "",
    expeditor_label: r.expeditor_label ?? "",
    qty_ordered: decStr(r.qty_ordered),
    qty_returned: decStr(r.return_qty_effective),
    qty_bonus_ordered: decStr(r.qty_bonus_ordered),
    qty_bonus_returned: decStr(r.return_bonus_effective),
    qty_delivered: decStr(r.delivered_qty),
    qty_extra_order: decStr(r.extra_order_qty),
    qty_bonus_delivery: decStr(r.bonus_delivery_qty),
    sum_bonus_delivery: decStr(r.bonus_delivery_sum),
    sum_before: decStr(r.total_sum),
    sum_return: decStr(r.refund_sum),
    sum_after: decStr(sumAfter),
    reason_agent: r.request_type_ref ?? "",
    reason_expeditor: r.refusal_reasons ?? ""
  };
}

type ProdRowRaw = {
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string | null;
  qty_ordered: Prisma.Decimal;
  qty_returned: Prisma.Decimal;
  qty_bonus_ordered: Prisma.Decimal;
  qty_bonus_returned: Prisma.Decimal;
  qty_delivered: Prisma.Decimal;
  qty_return_wh: Prisma.Decimal;
};

type ClientProdRowRaw = ProdRowRaw & { client_id: number; client_name: string };

/** Convert base qty (pieces) using product row `p` for pack/volume/weight. */
export function unitQtySql(mode: ExpeditorReturnsUnitMode, qtyCol: Prisma.Sql): Prisma.Sql {
  if (mode === "pack") {
    return Prisma.sql`(${qtyCol} / NULLIF(COALESCE(p.qty_per_block, 0), 0))::numeric(20,6)`;
  }
  if (mode === "volume") {
    return Prisma.sql`(${qtyCol} * COALESCE(p.volume_m3, 0::numeric))::numeric(20,6)`;
  }
  if (mode === "weight") {
    return Prisma.sql`(${qtyCol} * COALESCE(p.weight_kg, 0::numeric))::numeric(20,6)`;
  }
  return Prisma.sql`${qtyCol}::numeric(20,6)`;
}

export function scopeCte(tenantId: number, f: ExpeditorReturnsFilters, actor?: ReportActor): Prisma.Sql {
  const whereSql = buildExpeditorOrderWhereSql(tenantId, f, actor);
  return Prisma.sql`
    ${STATUS_CTE},
    order_scope AS (
      SELECT o.id
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      WHERE ${whereSql}
    )
  `;
}

export function aggProductSearchSql(f: ExpeditorReturnsFilters): Prisma.Sql {
  const t = f.search_products?.trim();
  if (!t) return Prisma.sql`true`;
  const esc = t.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pat = `%${esc}%`;
  const idTry = Number.parseInt(t, 10);
  if (Number.isFinite(idTry) && String(idTry) === t) {
    return Prisma.sql`(fin.product_name ILIKE ${pat} OR fin.sku ILIKE ${pat} OR COALESCE(fin.category_name, '') ILIKE ${pat} OR fin.product_id = ${idTry})`;
  }
  return Prisma.sql`(fin.product_name ILIKE ${pat} OR fin.sku ILIKE ${pat} OR COALESCE(fin.category_name, '') ILIKE ${pat})`;
}

export function aggClientSearchSql(f: ExpeditorReturnsFilters): Prisma.Sql {
  const t = f.search_clients?.trim();
  if (!t) return Prisma.sql`true`;
  const esc = t.replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pat = `%${esc}%`;
  const idTry = Number.parseInt(t, 10);
  if (Number.isFinite(idTry) && String(idTry) === t) {
    return Prisma.sql`(fin.client_name ILIKE ${pat} OR fin.product_name ILIKE ${pat} OR fin.sku ILIKE ${pat} OR COALESCE(fin.category_name, '') ILIKE ${pat} OR fin.product_id = ${idTry} OR fin.client_id = ${idTry})`;
  }
  return Prisma.sql`(fin.client_name ILIKE ${pat} OR fin.product_name ILIKE ${pat} OR fin.sku ILIKE ${pat} OR COALESCE(fin.category_name, '') ILIKE ${pat})`;
}

