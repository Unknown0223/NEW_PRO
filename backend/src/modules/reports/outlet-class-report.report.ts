import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  formatOutletClientCode,
  formatOutletTerritory,
  mergeCategoryShareMaps,
  orderCategoryColumns,
  sharesToPctRecord
} from "./outlet-class-report.format";
import type {
  OutletClassBand,
  OutletClassReportFilters,
  OutletClassReportResult,
  OutletClassReportRow,
  OutletClassReportTotals
} from "./outlet-class-report.types";

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

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

function classCaseSql(bands: OutletClassBand[]): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  for (const b of bands) {
    parts.push(Prisma.sql`WHEN s.sales_sum >= ${b.min_sum} THEN ${b.name}`);
  }
  return Prisma.sql`CASE ${Prisma.join(parts, " ")} ELSE ${bands.at(-1)?.name ?? "D"} END`;
}

type Raw = {
  class_name: string;
  client_id: number | null;
  client_inn: string | null;
  client_name: string;
  agent_name: string;
  client_category: string;
  zone: string | null;
  region: string | null;
  city: string | null;
  client_count: bigint;
  order_count: bigint;
  product_count: bigint;
  sales_sum: Prisma.Decimal;
  avg_check: Prisma.Decimal;
  total_count: bigint;
  sum_clients: bigint;
  sum_orders: bigint;
  sum_sales: Prisma.Decimal;
};

type CatRaw = { client_id: number; cat_name: string; cat_sum: Prisma.Decimal };

export async function getOutletClassReport(
  tenantId: number,
  f: OutletClassReportFilters,
  actor?: ReportActor
): Promise<OutletClassReportResult> {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const offset = (f.page - 1) * f.limit;
  const classExpr = classCaseSql(f.bands);

  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (from) parts.push(Prisma.sql`o.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`o.created_at <= ${to}`);
  if (f.statuses.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  else parts.push(Prisma.sql`o.status <> 'cancelled'`);
  if (f.agent_ids.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
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
        COALESCE(c.name, '') ILIKE ${pat}
        OR COALESCE(ag.name, '') ILIKE ${pat}
        OR COALESCE(c.phone, '') ILIKE ${pat}
        OR COALESCE(c.inn, '') ILIKE ${pat}
      )`
    );
  }
  if (scopedActor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, scopedActor));
  }
  const whereSql = Prisma.join(parts, " AND ");

  const clientSalesCte = Prisma.sql`
    orders_base AS (
      SELECT
        o.id AS order_id,
        o.client_id,
        COALESCE(NULLIF(c.name, ''), '—') AS client_name,
        COALESCE(c.inn, '') AS client_inn,
        COALESCE(ag.name, '') AS agent_name,
        COALESCE(c.category, '') AS client_category,
        COALESCE(c.zone, '') AS zone,
        COALESCE(c.region, '') AS region,
        COALESCE(c.city, '') AS city,
        o.total_sum
      FROM orders o
      JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = o.tenant_id
      WHERE ${whereSql}
    ),
    products_by_client AS (
      SELECT ob.client_id, COUNT(DISTINCT oi.product_id)::bigint AS product_count
      FROM orders_base ob
      JOIN order_items oi ON oi.order_id = ob.order_id AND oi.is_bonus = false
      GROUP BY ob.client_id
    ),
    client_sales AS (
      SELECT
        ob.client_id,
        ob.client_name,
        MAX(ob.client_inn) AS client_inn,
        MAX(ob.agent_name) AS agent_name,
        MAX(ob.client_category) AS client_category,
        MAX(ob.zone) AS zone,
        MAX(ob.region) AS region,
        MAX(ob.city) AS city,
        COUNT(*)::bigint AS order_count,
        COALESCE(MAX(p.product_count), 0)::bigint AS product_count,
        COALESCE(SUM(ob.total_sum), 0)::numeric(15,2) AS sales_sum
      FROM orders_base ob
      LEFT JOIN products_by_client p ON p.client_id = ob.client_id
      GROUP BY ob.client_id, ob.client_name
    )
  `;

  let rows: Raw[];
  if (f.group_by === "class") {
    rows = await prisma.$queryRaw<Raw[]>`
      WITH ${clientSalesCte},
      scored AS (
        SELECT s.*, ${classExpr} AS class_name
        FROM client_sales s
      ),
      agg AS (
        SELECT
          class_name,
          NULL::int AS client_id,
          ''::text AS client_inn,
          class_name AS client_name,
          ''::text AS agent_name,
          ''::text AS client_category,
          ''::text AS zone,
          ''::text AS region,
          ''::text AS city,
          COUNT(*)::bigint AS client_count,
          SUM(order_count)::bigint AS order_count,
          SUM(product_count)::bigint AS product_count,
          SUM(sales_sum)::numeric(15,2) AS sales_sum,
          CASE WHEN SUM(order_count) > 0
            THEN (SUM(sales_sum) / SUM(order_count))::numeric(15,2)
            ELSE 0::numeric(15,2)
          END AS avg_check
        FROM scored
        GROUP BY class_name
      ),
      totals AS (
        SELECT
          COUNT(*)::bigint AS sum_clients,
          COALESCE(SUM(order_count), 0)::bigint AS sum_orders,
          COALESCE(SUM(sales_sum), 0)::numeric(15,2) AS sum_sales
        FROM scored
      )
      SELECT a.*, COUNT(*) OVER()::bigint AS total_count, t.*
      FROM agg a CROSS JOIN totals t
      ORDER BY a.sales_sum DESC, a.class_name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `;
  } else {
    rows = await prisma.$queryRaw<Raw[]>`
      WITH ${clientSalesCte},
      scored AS (
        SELECT
          s.*,
          ${classExpr} AS class_name,
          1::bigint AS client_count,
          CASE WHEN s.order_count > 0
            THEN (s.sales_sum / s.order_count)::numeric(15,2)
            ELSE 0::numeric(15,2)
          END AS avg_check
        FROM client_sales s
      ),
      totals AS (
        SELECT
          COUNT(*)::bigint AS sum_clients,
          COALESCE(SUM(order_count), 0)::bigint AS sum_orders,
          COALESCE(SUM(sales_sum), 0)::numeric(15,2) AS sum_sales
        FROM scored
      )
      SELECT
        sc.class_name,
        sc.client_id,
        sc.client_inn,
        sc.client_name,
        sc.agent_name,
        sc.client_category,
        sc.zone,
        sc.region,
        sc.city,
        sc.client_count,
        sc.order_count,
        sc.product_count,
        sc.sales_sum,
        sc.avg_check,
        COUNT(*) OVER()::bigint AS total_count,
        t.sum_clients,
        t.sum_orders,
        t.sum_sales
      FROM scored sc CROSS JOIN totals t
      ORDER BY sc.sales_sum DESC, sc.client_name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `;
  }

  const catRows = await prisma.$queryRaw<CatRaw[]>`
    WITH ${clientSalesCte},
    scored AS (
      SELECT s.client_id, s.sales_sum, ${classExpr} AS class_name
      FROM client_sales s
    ),
    cat AS (
      SELECT
        ob.client_id,
        COALESCE(NULLIF(pc.name, ''), 'Без категории') AS cat_name,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS cat_sum
      FROM orders_base ob
      JOIN order_items oi ON oi.order_id = ob.order_id AND oi.is_bonus = false
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN product_categories pc ON pc.id = p.category_id AND pc.tenant_id = ${tenantId}
      GROUP BY ob.client_id, COALESCE(NULLIF(pc.name, ''), 'Без категории')
    )
    SELECT c.client_id, c.cat_name, c.cat_sum
    FROM cat c
    JOIN scored s ON s.client_id = c.client_id
  `;

  const amountsByClient = new Map<number, Record<string, number>>();
  const amountsByClass = new Map<string, Record<string, number>>();
  const classOfClient = new Map<number, string>();

  // class_name per client from a light pass — reuse cat join scored via second map from rows when client mode
  for (const c of catRows) {
    const cur = amountsByClient.get(c.client_id) ?? {};
    cur[c.cat_name] = (cur[c.cat_name] ?? 0) + Number(c.cat_sum);
    amountsByClient.set(c.client_id, cur);
  }

  if (f.group_by === "class") {
    const scoredClients = await prisma.$queryRaw<Array<{ client_id: number; class_name: string }>>`
      WITH ${clientSalesCte},
      scored AS (
        SELECT s.client_id, ${classExpr} AS class_name
        FROM client_sales s
      )
      SELECT client_id, class_name FROM scored
    `;
    for (const s of scoredClients) classOfClient.set(s.client_id, s.class_name);
    for (const [cid, am] of amountsByClient) {
      const cn = classOfClient.get(cid);
      if (!cn) continue;
      const prev = amountsByClass.get(cn) ?? {};
      amountsByClass.set(cn, mergeCategoryShareMaps([prev, am]));
    }
  }

  const globalCatTotals: Record<string, number> = {};
  const sourceMaps =
    f.group_by === "class" ? [...amountsByClass.values()] : [...amountsByClient.values()];
  for (const m of sourceMaps) {
    for (const [k, v] of Object.entries(m)) {
      globalCatTotals[k] = (globalCatTotals[k] ?? 0) + v;
    }
  }
  const category_columns = orderCategoryColumns(globalCatTotals);

  const mapped: OutletClassReportRow[] = rows.map((r, idx) => {
    const sales = Number(r.sales_sum ?? 0);
    let amounts: Record<string, number> = {};
    if (f.group_by === "class") {
      amounts = amountsByClass.get(r.class_name ?? "") ?? {};
    } else if (r.client_id != null) {
      amounts = amountsByClient.get(r.client_id) ?? {};
    }
    return {
      row_number: offset + idx + 1,
      class_name: r.class_name ?? "",
      client_code: formatOutletClientCode(r.client_inn, r.client_id),
      client_id: r.client_id,
      client_name: r.client_name ?? "",
      agent_name: r.agent_name ?? "",
      client_category: r.client_category ?? "",
      territory: formatOutletTerritory(r.zone, r.region, r.city),
      client_count: Number(r.client_count ?? 0),
      order_count: Number(r.order_count ?? 0),
      product_count: Number(r.product_count ?? 0),
      sales_sum: decStr(r.sales_sum),
      avg_check: decStr(r.avg_check),
      category_shares: sharesToPctRecord(amounts, sales)
    };
  });

  const totals: OutletClassReportTotals = {
    client_count: Number(rows[0]?.sum_clients ?? 0),
    order_count: Number(rows[0]?.sum_orders ?? 0),
    sales_sum: decStr(rows[0]?.sum_sales)
  };

  return {
    period_from: f.from,
    period_to: f.to,
    group_by: f.group_by,
    bands: f.bands,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals,
    category_columns,
    rows: mapped
  };
}
