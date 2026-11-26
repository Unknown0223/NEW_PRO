import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { BonusesReportFilters } from "./bonuses-report.types";
import { buildBonusesReportWhere } from "./bonuses-report.where";
import { ORDER_STATUS_LABEL_RU, STATUS_CTE } from "./expeditor-returns.helpers";

/** Pivot/jadvalda status — faqat RU nom (filtr API hali kod bilan). */
export function universalBonusesStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL_RU[status] ?? status;
}

export const UNIVERSAL_BONUSES_DATASET_CAP = 5000;

export type UniversalBonusesPivotFieldMeta = {
  id: string;
  label: string;
  dataType: "string" | "number" | "date";
};

/** Design starter columns — SalesDoc `/report/bonus` line grain. */
export const UNIVERSAL_BONUSES_PIVOT_FIELDS: UniversalBonusesPivotFieldMeta[] = [
  { id: "order_id", label: "ID ЗАКАЗА", dataType: "number" },
  { id: "order_status", label: "СТАТУС", dataType: "string" },
  { id: "product_name", label: "ТОВАР", dataType: "string" },
  { id: "sku", label: "АРТИКУЛ", dataType: "string" },
  { id: "category_name", label: "КАТЕГОРИЯ", dataType: "string" },
  { id: "client_name", label: "КЛИЕНТ", dataType: "string" },
  { id: "client_category", label: "КАТ. КЛИЕНТА", dataType: "string" },
  { id: "agent_name", label: "АГЕНТ", dataType: "string" },
  { id: "qty", label: "КОЛ-ВО", dataType: "number" },
  { id: "volume_m3", label: "ОБЪЁМ", dataType: "number" },
  { id: "line_total", label: "СУММА", dataType: "number" },
  { id: "created_at", label: "ДАТА СОЗДАНИЯ", dataType: "date" },
  { id: "shipped_at", label: "ДАТА ОТГРУЗКИ", dataType: "date" }
];

type RawLine = {
  order_id: number;
  order_status: string;
  product_name: string;
  sku: string;
  category_name: string;
  client_name: string;
  client_category: string;
  agent_name: string;
  qty: Prisma.Decimal;
  volume_m3: Prisma.Decimal;
  line_total: Prisma.Decimal;
  created_at: Date;
  shipped_at: Date | null;
  total_count: bigint;
};

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

/** Bonus order-item lines for Virtual Pivot (cap 5000). */
export async function getUniversalBonusesReportDataset(
  tenantId: number,
  f: BonusesReportFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildBonusesReportWhere(tenantId, f, scopedActor);
  const limit = UNIVERSAL_BONUSES_DATASET_CAP;

  const rows = await prisma.$queryRaw<RawLine[]>`
    WITH ${STATUS_CTE}
    SELECT
      o.id AS order_id,
      o.status AS order_status,
      p.name AS product_name,
      COALESCE(p.sku, '') AS sku,
      COALESCE(pc.name, '') AS category_name,
      c.name AS client_name,
      COALESCE(c.category, '') AS client_category,
      COALESCE(ag.name, '') AS agent_name,
      oi.qty,
      (oi.qty * COALESCE(p.volume_m3, 0::numeric))::numeric(18,6) AS volume_m3,
      oi.total AS line_total,
      o.created_at,
      COALESCE(sl.shipped_at, sl.delivered_at) AS shipped_at,
      COUNT(*) OVER()::bigint AS total_count
    FROM orders o
    JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id AND p.tenant_id = o.tenant_id
    LEFT JOIN product_categories pc ON pc.id = p.category_id AND pc.tenant_id = o.tenant_id
    LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = o.tenant_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    WHERE ${whereSql}
    ORDER BY o.created_at DESC, o.id DESC, oi.id DESC
    LIMIT ${limit}
  `;

  const total = rows.length ? Number(rows[0].total_count) : 0;
  const truncated = total > rows.length;

  return {
    fields: UNIVERSAL_BONUSES_PIVOT_FIELDS,
    rows: rows.map((r) => ({
      order_id: Number(r.order_id),
      order_status: universalBonusesStatusLabel(String(r.order_status ?? "")),
      product_name: r.product_name,
      sku: r.sku,
      category_name: r.category_name,
      client_name: r.client_name,
      client_category: r.client_category,
      agent_name: r.agent_name,
      qty: num(r.qty),
      volume_m3: num(r.volume_m3),
      line_total: num(r.line_total),
      created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      shipped_at: r.shipped_at ? new Date(r.shipped_at).toISOString() : null
    })),
    total,
    truncated
  };
}
