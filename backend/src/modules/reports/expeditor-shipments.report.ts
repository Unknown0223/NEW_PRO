import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import { STATUS_CTE } from "./expeditor-returns.helpers";
import type {
  ExpeditorShipmentsCell,
  ExpeditorShipmentsCol,
  ExpeditorShipmentsFilters,
  ExpeditorShipmentsRow
} from "./expeditor-shipments.types";

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

function dateExpr(f: ExpeditorShipmentsFilters): Prisma.Sql {
  if (f.date_type === "delivered_date") return Prisma.sql`sl.delivered_at`;
  if (f.date_type === "shipped_date") return Prisma.sql`sl.shipped_at`;
  return Prisma.sql`o.created_at`;
}

function moneyStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0.00";
  return new Prisma.Decimal(v).toFixed(2);
}

function qtyStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return new Prisma.Decimal(v).toFixed(3).replace(/\.?0+$/, "") || "0";
}

function emptyCell(): ExpeditorShipmentsCell {
  return { block_count: 0, volume: "0", qty: "0", amount: "0.00" };
}

function colKey(id: number | null): string {
  return id == null ? "none" : String(id);
}

function buildWhere(tenantId: number, f: ExpeditorShipmentsFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dexpr = dateExpr(f);
  if (from) parts.push(Prisma.sql`${dexpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dexpr} <= ${to}`);
  if (f.statuses?.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  else parts.push(Prisma.sql`o.status <> 'cancelled'`);
  if (f.expeditor_ids?.length) {
    parts.push(Prisma.sql`o.expeditor_user_id IN (${Prisma.join(f.expeditor_ids)})`);
  }
  if (f.category_ids?.length) {
    parts.push(Prisma.sql`p.category_id IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.product_ids?.length) {
    parts.push(Prisma.sql`p.id IN (${Prisma.join(f.product_ids)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(Prisma.sql`(p.name ILIKE ${pat} OR p.sku ILIKE ${pat} OR COALESCE(pc.name, '') ILIKE ${pat})`);
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}

export async function getExpeditorShipmentsReport(
  tenantId: number,
  f: ExpeditorShipmentsFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;

  type ProductPage = {
    product_id: number;
    product_name: string;
    category_name: string | null;
    total_count: bigint;
  };

  const productPage = await prisma.$queryRaw<ProductPage[]>`
    WITH ${STATUS_CTE},
    sold AS (
      SELECT DISTINCT p.id AS product_id, p.name AS product_name, COALESCE(pc.name, '') AS category_name
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      WHERE ${whereSql}
    )
    SELECT
      s.product_id,
      s.product_name,
      s.category_name,
      COUNT(*) OVER()::bigint AS total_count
    FROM sold s
    ORDER BY s.category_name ASC, s.product_name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const total = Number(productPage[0]?.total_count ?? 0);
  const productIds = productPage.map((p) => p.product_id);

  type AggRaw = {
    product_id: number;
    expeditor_id: number | null;
    expeditor_name: string | null;
    block_count: bigint;
    volume: Prisma.Decimal;
    qty: Prisma.Decimal;
    amount: Prisma.Decimal;
  };

  const aggs =
    productIds.length === 0
      ? []
      : await prisma.$queryRaw<AggRaw[]>`
          WITH ${STATUS_CTE}
          SELECT
            oi.product_id,
            o.expeditor_user_id AS expeditor_id,
            COALESCE(ex.name, 'Без экспедитора') AS expeditor_name,
            COUNT(DISTINCT o.warehouse_block_id)::bigint AS block_count,
            COALESCE(SUM(oi.qty * COALESCE(p.volume_m3, 0)), 0)::numeric(18,6) AS volume,
            COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS qty,
            COALESCE(SUM(oi.total), 0)::numeric(15,2) AS amount
          FROM orders o
          JOIN clients c ON c.id = o.client_id
          JOIN order_items oi ON oi.order_id = o.id
          JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
          LEFT JOIN product_categories pc ON pc.id = p.category_id
          LEFT JOIN status_logs sl ON sl.order_id = o.id
          LEFT JOIN users ex ON ex.id = o.expeditor_user_id
          WHERE ${whereSql}
            AND oi.product_id IN (${Prisma.join(productIds)})
          GROUP BY oi.product_id, o.expeditor_user_id, ex.name
        `;

  type TotRaw = {
    expeditor_id: number | null;
    expeditor_name: string | null;
    block_count: bigint;
    volume: Prisma.Decimal;
    qty: Prisma.Decimal;
    amount: Prisma.Decimal;
    invoice_count: bigint;
  };
  const totalsRaw = await prisma.$queryRaw<TotRaw[]>`
    WITH ${STATUS_CTE}
    SELECT
      o.expeditor_user_id AS expeditor_id,
      COALESCE(ex.name, 'Без экспедитора') AS expeditor_name,
      COUNT(DISTINCT o.warehouse_block_id)::bigint AS block_count,
      COALESCE(SUM(oi.qty * COALESCE(p.volume_m3, 0)), 0)::numeric(18,6) AS volume,
      COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS qty,
      COALESCE(SUM(oi.total), 0)::numeric(15,2) AS amount,
      COUNT(DISTINCT o.id)::bigint AS invoice_count
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    LEFT JOIN users ex ON ex.id = o.expeditor_user_id
    WHERE ${whereSql}
    GROUP BY o.expeditor_user_id, ex.name
  `;

  const colMap = new Map<string, ExpeditorShipmentsCol>();
  for (const r of [...aggs, ...totalsRaw]) {
    const key = colKey(r.expeditor_id);
    if (!colMap.has(key)) {
      colMap.set(key, {
        expeditor_id: r.expeditor_id,
        expeditor_name: r.expeditor_name || "Без экспедитора"
      });
    }
  }

  // Prefer filter list order when expeditors selected; else name sort with "none" last
  const columns: ExpeditorShipmentsCol[] = [...colMap.values()];
  if (f.expeditor_ids?.length) {
    const order = new Map(f.expeditor_ids.map((id, i) => [String(id), i]));
    columns.sort((a, b) => {
      const ai = a.expeditor_id == null ? 9999 : (order.get(String(a.expeditor_id)) ?? 9998);
      const bi = b.expeditor_id == null ? 9999 : (order.get(String(b.expeditor_id)) ?? 9998);
      return ai - bi || a.expeditor_name.localeCompare(b.expeditor_name, "ru");
    });
  } else {
    columns.sort((a, b) => {
      if (a.expeditor_id == null) return 1;
      if (b.expeditor_id == null) return -1;
      return a.expeditor_name.localeCompare(b.expeditor_name, "ru");
    });
  }

  const cellMap = new Map<string, ExpeditorShipmentsCell>();
  for (const r of aggs) {
    cellMap.set(`${r.product_id}:${colKey(r.expeditor_id)}`, {
      block_count: Number(r.block_count),
      volume: qtyStr(r.volume),
      qty: qtyStr(r.qty),
      amount: moneyStr(r.amount)
    });
  }

  const rows: ExpeditorShipmentsRow[] = productPage.map((p, idx) => {
    const cells: Record<string, ExpeditorShipmentsCell> = {};
    for (const col of columns) {
      const key = colKey(col.expeditor_id);
      cells[key] = cellMap.get(`${p.product_id}:${key}`) ?? emptyCell();
    }
    return {
      row_number: offset + idx + 1,
      product_id: p.product_id,
      product_name: p.product_name,
      category_name: p.category_name ?? "",
      cells
    };
  });

  const column_totals: Record<string, ExpeditorShipmentsCell & { invoice_count: number }> = {};
  for (const col of columns) {
    const key = colKey(col.expeditor_id);
    const t = totalsRaw.find((x) => colKey(x.expeditor_id) === key);
    column_totals[key] = t
      ? {
          block_count: Number(t.block_count),
          volume: qtyStr(t.volume),
          qty: qtyStr(t.qty),
          amount: moneyStr(t.amount),
          invoice_count: Number(t.invoice_count)
        }
      : { ...emptyCell(), invoice_count: 0 };
  }

  return {
    period_from: f.from,
    period_to: f.to,
    date_type: f.date_type,
    page: f.page,
    limit: f.limit,
    total,
    columns,
    rows,
    column_totals
  };
}
