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
import type { ExpeditorReturnsFilters } from "./expeditor-returns.types";
import {
  aggClientSearchSql,
  aggProductSearchSql,
  decStr,
  scopeCte,
  unitQtySql
} from "./expeditor-returns.helpers";

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

export async function getExpeditorReturnsByProducts(
  tenantId: number,
  f: ExpeditorReturnsFilters,
  actor?: ReportActor
) {
  const uo = unitQtySql(f.unit_mode, Prisma.sql`j.oq`);
  const uob = unitQtySql(f.unit_mode, Prisma.sql`j.obq`);
  const urt = unitQtySql(f.unit_mode, Prisma.sql`j.rq`);
  const urb = unitQtySql(f.unit_mode, Prisma.sql`j.rbq`);

  const rows = await prisma.$queryRaw<ProdRowRaw[]>`
    WITH ${scopeCte(tenantId, f, actor)},
    oi_lines AS (
      SELECT oi.order_id, oi.product_id, oi.is_bonus, oi.exchange_line_kind, oi.qty
      FROM order_items oi
      JOIN order_scope os ON os.id = oi.order_id
    ),
    ret_by_line AS (
      SELECT
        sr.order_id,
        srl.product_id,
        SUM(srl.qty)::numeric(20,6) AS rq,
        SUM(COALESCE(srl.bonus_qty, 0::numeric))::numeric(20,6) AS rbq
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.return_id = sr.id
      WHERE sr.tenant_id = ${tenantId}
        AND sr.status = 'posted'
        AND sr.order_id IS NOT NULL
      GROUP BY sr.order_id, srl.product_id
    ),
    order_prod AS (
      SELECT
        o.id AS order_id,
        o.status AS order_status,
        ol.product_id,
        SUM(CASE
          WHEN ol.is_bonus = false AND (ol.exchange_line_kind IS NULL OR ol.exchange_line_kind <> 'minus')
            THEN ol.qty ELSE 0::numeric
        END)::numeric(20,6) AS oq,
        SUM(CASE WHEN ol.is_bonus = true THEN ol.qty ELSE 0::numeric END)::numeric(20,6) AS obq
      FROM oi_lines ol
      JOIN orders o ON o.id = ol.order_id AND o.tenant_id = ${tenantId}
      GROUP BY o.id, o.status, ol.product_id
    ),
    joined AS (
      SELECT
        op.order_id,
        op.product_id,
        op.oq,
        op.obq,
        COALESCE(
          r.rq,
          CASE WHEN op.order_status IN ('cancelled', 'returned') THEN op.oq ELSE 0::numeric END
        ) AS rq,
        COALESCE(
          r.rbq,
          CASE WHEN op.order_status IN ('cancelled', 'returned') THEN op.obq ELSE 0::numeric END
        ) AS rbq
      FROM order_prod op
      LEFT JOIN ret_by_line r ON r.order_id = op.order_id AND r.product_id = op.product_id
    ),
    fin AS (
      SELECT
        j.product_id,
        MAX(p.name) AS product_name,
        MAX(p.sku) AS sku,
        MAX(pc.name) AS category_name,
        SUM(${uo})::numeric(20,6) AS qty_ordered,
        SUM(${urt})::numeric(20,6) AS qty_returned,
        SUM(${uob})::numeric(20,6) AS qty_bonus_ordered,
        SUM(${urb})::numeric(20,6) AS qty_bonus_returned,
        SUM(GREATEST(0::numeric, ${uo} - (${urt} - ${urb})))::numeric(20,6) AS qty_delivered,
        SUM(${urt})::numeric(20,6) AS qty_return_wh
      FROM joined j
      JOIN products p ON p.id = j.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      GROUP BY j.product_id
      HAVING SUM(${uo}) > 0 OR SUM(${urt}) > 0
    )
    SELECT * FROM fin
    WHERE ${aggProductSearchSql(f)}
    ORDER BY fin.qty_returned DESC NULLS LAST, fin.product_name ASC
    ${f.agg_products_limit == null ? Prisma.empty : Prisma.sql`LIMIT ${f.agg_products_limit}`}
  `;

  return {
    unit_mode: f.unit_mode,
    rows: rows.map((r, i) => ({
      row_number: i + 1,
      product_id: r.product_id,
      category_name: r.category_name ?? "",
      product_name: r.product_name,
      sku: r.sku,
      qty_ordered: decStr(r.qty_ordered),
      qty_returned: decStr(r.qty_returned),
      qty_bonus_ordered: decStr(r.qty_bonus_ordered),
      qty_bonus_returned: decStr(r.qty_bonus_returned),
      qty_delivered: decStr(r.qty_delivered),
      qty_return_warehouse: decStr(r.qty_return_wh)
    }))
  };
}

export async function getExpeditorReturnsByClients(
  tenantId: number,
  f: ExpeditorReturnsFilters,
  actor?: ReportActor
) {
  const uo = unitQtySql(f.unit_mode, Prisma.sql`j.oq`);
  const uob = unitQtySql(f.unit_mode, Prisma.sql`j.obq`);
  const urt = unitQtySql(f.unit_mode, Prisma.sql`j.rq`);
  const urb = unitQtySql(f.unit_mode, Prisma.sql`j.rbq`);

  const rows = await prisma.$queryRaw<ClientProdRowRaw[]>`
    WITH ${scopeCte(tenantId, f, actor)},
    oi_lines AS (
      SELECT o.client_id, oi.order_id, oi.product_id, oi.is_bonus, oi.exchange_line_kind, oi.qty
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id AND o.tenant_id = ${tenantId}
      JOIN order_scope os ON os.id = oi.order_id
    ),
    ret_by_line AS (
      SELECT
        sr.order_id,
        srl.product_id,
        SUM(srl.qty)::numeric(20,6) AS rq,
        SUM(COALESCE(srl.bonus_qty, 0::numeric))::numeric(20,6) AS rbq
      FROM sales_returns sr
      JOIN sales_return_lines srl ON srl.return_id = sr.id
      WHERE sr.tenant_id = ${tenantId}
        AND sr.status = 'posted'
        AND sr.order_id IS NOT NULL
      GROUP BY sr.order_id, srl.product_id
    ),
    order_prod AS (
      SELECT
        ol.client_id,
        o.id AS order_id,
        o.status AS order_status,
        ol.product_id,
        SUM(CASE
          WHEN ol.is_bonus = false AND (ol.exchange_line_kind IS NULL OR ol.exchange_line_kind <> 'minus')
            THEN ol.qty ELSE 0::numeric
        END)::numeric(20,6) AS oq,
        SUM(CASE WHEN ol.is_bonus = true THEN ol.qty ELSE 0::numeric END)::numeric(20,6) AS obq
      FROM oi_lines ol
      JOIN orders o ON o.id = ol.order_id AND o.tenant_id = ${tenantId}
      GROUP BY ol.client_id, o.id, o.status, ol.product_id
    ),
    joined AS (
      SELECT
        op.client_id,
        op.order_id,
        op.product_id,
        op.oq,
        op.obq,
        COALESCE(
          r.rq,
          CASE WHEN op.order_status IN ('cancelled', 'returned') THEN op.oq ELSE 0::numeric END
        ) AS rq,
        COALESCE(
          r.rbq,
          CASE WHEN op.order_status IN ('cancelled', 'returned') THEN op.obq ELSE 0::numeric END
        ) AS rbq
      FROM order_prod op
      LEFT JOIN ret_by_line r ON r.order_id = op.order_id AND r.product_id = op.product_id
    ),
    fin AS (
      SELECT
        j.client_id,
        MAX(cl.name) AS client_name,
        j.product_id,
        MAX(p.name) AS product_name,
        MAX(p.sku) AS sku,
        MAX(pc.name) AS category_name,
        SUM(${uo})::numeric(20,6) AS qty_ordered,
        SUM(${urt})::numeric(20,6) AS qty_returned,
        SUM(${uob})::numeric(20,6) AS qty_bonus_ordered,
        SUM(${urb})::numeric(20,6) AS qty_bonus_returned,
        SUM(GREATEST(0::numeric, ${uo} - (${urt} - ${urb})))::numeric(20,6) AS qty_delivered,
        SUM(${urt})::numeric(20,6) AS qty_return_wh
      FROM joined j
      JOIN clients cl ON cl.id = j.client_id AND cl.tenant_id = ${tenantId}
      JOIN products p ON p.id = j.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      GROUP BY j.client_id, j.product_id
      HAVING SUM(${uo}) > 0 OR SUM(${urt}) > 0
    )
    SELECT * FROM fin
    WHERE ${aggClientSearchSql(f)}
    ORDER BY fin.qty_returned DESC NULLS LAST, fin.client_name ASC, fin.product_name ASC
    ${f.agg_clients_limit == null ? Prisma.empty : Prisma.sql`LIMIT ${f.agg_clients_limit}`}
  `;

  return {
    unit_mode: f.unit_mode,
    rows: rows.map((r, i) => ({
      row_number: i + 1,
      client_id: r.client_id,
      client_name: r.client_name,
      product_id: r.product_id,
      category_name: r.category_name ?? "",
      product_name: r.product_name,
      sku: r.sku,
      qty_ordered: decStr(r.qty_ordered),
      qty_returned: decStr(r.qty_returned),
      qty_bonus_ordered: decStr(r.qty_bonus_ordered),
      qty_bonus_returned: decStr(r.qty_bonus_returned),
      qty_delivered: decStr(r.qty_delivered),
      qty_return_warehouse: decStr(r.qty_return_wh)
    }))
  };
}

const EXPORT_CAP = 8000;

