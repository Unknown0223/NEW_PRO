import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { STATUS_CTE } from "./expeditor-returns.helpers";
import type { ExcelExportStatusSummary } from "./excel-export.types";

function moneyStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0.00";
  return new Prisma.Decimal(v).toFixed(2);
}

function qtyStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return new Prisma.Decimal(v).toFixed(3).replace(/\.?0+$/, "") || "0";
}

const BUCKETS: Array<{
  id: ExcelExportStatusSummary["id"];
  label: string;
  statuses: string[];
  match: string[];
}> = [
  {
    id: "new",
    label: "Новые",
    statuses: ["new", "confirmed", "picking"],
    match: ["new", "confirmed", "picking"]
  },
  {
    id: "shipped",
    label: "Отгруженные",
    statuses: ["delivering"],
    match: ["delivering", "shipped"]
  },
  {
    id: "delivered",
    label: "Доставленные",
    statuses: ["delivered"],
    match: ["delivered"]
  },
  {
    id: "returned",
    label: "Возвращенные",
    statuses: ["returned"],
    match: ["returned"]
  },
  {
    id: "cancelled",
    label: "Отмененные",
    statuses: ["cancelled"],
    match: ["cancelled"]
  }
];

type BucketRaw = {
  bucket: string;
  amount: Prisma.Decimal;
  qty: Prisma.Decimal;
  volume: Prisma.Decimal;
  akb: bigint;
};

/** Status cards for SalesDoc Version1 — independent of row status filter. */
export async function getExcelExportStatusSummaries(
  tenantId: number,
  whereWithoutStatus: Prisma.Sql
): Promise<ExcelExportStatusSummary[]> {
  const raw = await prisma.$queryRaw<BucketRaw[]>`
    WITH ${STATUS_CTE},
    lined AS (
      SELECT
        o.id AS order_id,
        o.client_id,
        o.status,
        oi.qty,
        oi.total AS amount,
        oi.qty * COALESCE(p.volume_m3, 0) AS volume
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      WHERE ${whereWithoutStatus}
    )
    SELECT
      CASE
        WHEN status IN ('new', 'confirmed', 'picking') THEN 'new'
        WHEN status IN ('delivering', 'shipped') THEN 'shipped'
        WHEN status = 'delivered' THEN 'delivered'
        WHEN status = 'returned' THEN 'returned'
        WHEN status = 'cancelled' THEN 'cancelled'
        ELSE 'new'
      END AS bucket,
      COALESCE(SUM(amount), 0)::numeric(15,2) AS amount,
      COALESCE(SUM(qty), 0)::numeric(15,3) AS qty,
      COALESCE(SUM(volume), 0)::numeric(18,6) AS volume,
      COUNT(DISTINCT client_id)::bigint AS akb
    FROM lined
    GROUP BY 1
  `;

  const byBucket = new Map(raw.map((r) => [r.bucket, r]));
  let allAmount = 0;
  let allQty = 0;
  let allVolume = 0;

  const cards: ExcelExportStatusSummary[] = BUCKETS.map((b) => {
    const r = byBucket.get(b.id);
    const amount = r ? Number(r.amount) : 0;
    const qty = r ? Number(r.qty) : 0;
    const volume = r ? Number(r.volume) : 0;
    const akb = r ? Number(r.akb) : 0;
    allAmount += amount;
    allQty += qty;
    allVolume += volume;
    return {
      id: b.id,
      label: b.label,
      statuses: b.statuses,
      amount: moneyStr(amount),
      qty: qtyStr(qty),
      volume: qtyStr(volume),
      akb
    };
  });

  const allAkbRaw = await prisma.$queryRaw<Array<{ akb: bigint }>>`
    WITH ${STATUS_CTE}
    SELECT COUNT(DISTINCT o.client_id)::bigint AS akb
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    WHERE ${whereWithoutStatus}
  `;

  cards.unshift({
    id: "all",
    label: "Общие заявки",
    statuses: [],
    amount: moneyStr(allAmount),
    qty: qtyStr(allQty),
    volume: qtyStr(allVolume),
    akb: Number(allAkbRaw[0]?.akb ?? 0)
  });

  return cards;
}
