import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { CumulativeBonusFilters, CumulativeBonusRow } from "./cumulative-bonus.types";

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

const STATUS_CTE = Prisma.sql`
  status_logs AS (
    SELECT
      sl.order_id,
      MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at
    FROM order_status_logs sl
    GROUP BY sl.order_id
  )
`;

function buildWhere(tenantId: number, f: CumulativeBonusFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dateExpr = f.date_type === "shipped_date" ? Prisma.sql`sl.shipped_at` : Prisma.sql`o.created_at`;
  if (from) parts.push(Prisma.sql`${dateExpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dateExpr} <= ${to}`);
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
  if (f.bonus_rule_ids.length) {
    parts.push(Prisma.sql`o.applied_auto_bonus_rule_ids && ARRAY[${Prisma.join(f.bonus_rule_ids)}]::int[]`);
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
      )`
    );
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}

type Raw = {
  group_key: string;
  name: string;
  agent_name: string;
  client_name: string;
  rule_name: string;
  purchase_sum: Prisma.Decimal;
  bonus_qty: Prisma.Decimal;
  bonus_sum: Prisma.Decimal;
  order_count: bigint;
  akb: bigint;
  rules_count: bigint;
  total_count: bigint;
  sum_purchase: Prisma.Decimal;
  sum_bonus_qty: Prisma.Decimal;
  sum_bonus_sum: Prisma.Decimal;
  sum_orders: bigint;
  sum_akb: bigint;
};

export async function getCumulativeBonusReport(
  tenantId: number,
  f: CumulativeBonusFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;

  let rows: Raw[];
  if (f.group_by === "rule") {
    rows = await prisma.$queryRaw<Raw[]>`
      WITH ${STATUS_CTE},
      orders_base AS (
        SELECT
          o.id AS order_id,
          o.client_id,
          o.bonus_sum,
          o.applied_auto_bonus_rule_ids,
          COALESCE((
            SELECT SUM(oi.total) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.is_bonus = false
          ), 0)::numeric(15,2) AS purchase_sum,
          COALESCE((
            SELECT SUM(oi.qty) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.is_bonus = true
          ), 0)::numeric(15,3) AS bonus_qty
        FROM orders o
        JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
        LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = o.tenant_id
        LEFT JOIN status_logs sl ON sl.order_id = o.id
        WHERE ${whereSql}
          AND cardinality(o.applied_auto_bonus_rule_ids) > 0
      ),
      base AS (
        SELECT
          ob.*,
          rid AS rule_id,
          COALESCE(br.name, 'Правило #' || rid::text) AS rule_name
        FROM orders_base ob
        CROSS JOIN LATERAL unnest(ob.applied_auto_bonus_rule_ids) AS rid
        LEFT JOIN bonus_rules br ON br.id = rid AND br.tenant_id = ${tenantId}
      ),
      totals AS (
        SELECT
          COALESCE(SUM(ob.purchase_sum), 0)::numeric(15,2) AS sum_purchase,
          COALESCE(SUM(ob.bonus_qty), 0)::numeric(15,3) AS sum_bonus_qty,
          COALESCE(SUM(ob.bonus_sum), 0)::numeric(15,2) AS sum_bonus_sum,
          COUNT(DISTINCT ob.order_id)::bigint AS sum_orders,
          COUNT(DISTINCT ob.client_id)::bigint AS sum_akb
        FROM orders_base ob
      ),
      agg AS (
        SELECT
          b.rule_id::text AS group_key,
          b.rule_name AS name,
          ''::text AS agent_name,
          ''::text AS client_name,
          b.rule_name,
          0::numeric(15,2) AS purchase_sum,
          0::numeric(15,3) AS bonus_qty,
          0::numeric(15,2) AS bonus_sum,
          COUNT(DISTINCT b.order_id)::bigint AS order_count,
          COUNT(DISTINCT b.client_id)::bigint AS akb,
          1::bigint AS rules_count
        FROM base b
        GROUP BY b.rule_id, b.rule_name
      )
      SELECT a.*, COUNT(*) OVER()::bigint AS total_count, t.*
      FROM agg a CROSS JOIN totals t
      ORDER BY a.bonus_qty DESC, a.name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `;
  } else if (f.group_by === "agent") {
    rows = await prisma.$queryRaw<Raw[]>`
      WITH ${STATUS_CTE},
      base AS (
        SELECT
          o.id AS order_id,
          o.client_id,
          COALESCE(ag.id, 0) AS agent_id,
          COALESCE(NULLIF(ag.name, ''), '—') AS agent_name,
          o.bonus_sum,
          cardinality(o.applied_auto_bonus_rule_ids)::int AS rules_count,
          COALESCE((
            SELECT SUM(oi.total) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.is_bonus = false
          ), 0)::numeric(15,2) AS purchase_sum,
          COALESCE((
            SELECT SUM(oi.qty) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.is_bonus = true
          ), 0)::numeric(15,3) AS bonus_qty
        FROM orders o
        JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
        LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = o.tenant_id
        LEFT JOIN status_logs sl ON sl.order_id = o.id
        WHERE ${whereSql}
      ),
      totals AS (
        SELECT
          COALESCE(SUM(b.purchase_sum), 0)::numeric(15,2) AS sum_purchase,
          COALESCE(SUM(b.bonus_qty), 0)::numeric(15,3) AS sum_bonus_qty,
          COALESCE(SUM(b.bonus_sum), 0)::numeric(15,2) AS sum_bonus_sum,
          COUNT(DISTINCT b.order_id)::bigint AS sum_orders,
          COUNT(DISTINCT b.client_id)::bigint AS sum_akb
        FROM base b
      ),
      agg AS (
        SELECT
          b.agent_id::text AS group_key,
          b.agent_name AS name,
          b.agent_name,
          ''::text AS client_name,
          ''::text AS rule_name,
          SUM(b.purchase_sum)::numeric(15,2) AS purchase_sum,
          SUM(b.bonus_qty)::numeric(15,3) AS bonus_qty,
          SUM(b.bonus_sum)::numeric(15,2) AS bonus_sum,
          COUNT(DISTINCT b.order_id)::bigint AS order_count,
          COUNT(DISTINCT b.client_id)::bigint AS akb,
          COALESCE(SUM(b.rules_count), 0)::bigint AS rules_count
        FROM base b
        GROUP BY b.agent_id, b.agent_name
      )
      SELECT a.*, COUNT(*) OVER()::bigint AS total_count, t.*
      FROM agg a CROSS JOIN totals t
      ORDER BY a.purchase_sum DESC, a.name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `;
  } else {
    rows = await prisma.$queryRaw<Raw[]>`
      WITH ${STATUS_CTE},
      base AS (
        SELECT
          o.id AS order_id,
          o.client_id,
          c.name AS client_name,
          COALESCE(ag.name, '') AS agent_name,
          o.bonus_sum,
          cardinality(o.applied_auto_bonus_rule_ids)::int AS rules_count,
          COALESCE((
            SELECT SUM(oi.total) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.is_bonus = false
          ), 0)::numeric(15,2) AS purchase_sum,
          COALESCE((
            SELECT SUM(oi.qty) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.is_bonus = true
          ), 0)::numeric(15,3) AS bonus_qty
        FROM orders o
        JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
        LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id) AND ag.tenant_id = o.tenant_id
        LEFT JOIN status_logs sl ON sl.order_id = o.id
        WHERE ${whereSql}
      ),
      totals AS (
        SELECT
          COALESCE(SUM(b.purchase_sum), 0)::numeric(15,2) AS sum_purchase,
          COALESCE(SUM(b.bonus_qty), 0)::numeric(15,3) AS sum_bonus_qty,
          COALESCE(SUM(b.bonus_sum), 0)::numeric(15,2) AS sum_bonus_sum,
          COUNT(DISTINCT b.order_id)::bigint AS sum_orders,
          COUNT(DISTINCT b.client_id)::bigint AS sum_akb
        FROM base b
      ),
      agg AS (
        SELECT
          b.client_id::text AS group_key,
          b.client_name AS name,
          b.agent_name,
          b.client_name,
          ''::text AS rule_name,
          SUM(b.purchase_sum)::numeric(15,2) AS purchase_sum,
          SUM(b.bonus_qty)::numeric(15,3) AS bonus_qty,
          SUM(b.bonus_sum)::numeric(15,2) AS bonus_sum,
          COUNT(DISTINCT b.order_id)::bigint AS order_count,
          1::bigint AS akb,
          COALESCE(SUM(b.rules_count), 0)::bigint AS rules_count
        FROM base b
        GROUP BY b.client_id, b.client_name, b.agent_name
      )
      SELECT a.*, COUNT(*) OVER()::bigint AS total_count, t.*
      FROM agg a CROSS JOIN totals t
      ORDER BY a.purchase_sum DESC, a.name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `;
  }

  const mapped: CumulativeBonusRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    group_key: r.group_key,
    name: r.name,
    agent_name: r.agent_name ?? "",
    client_name: r.client_name ?? "",
    rule_name: r.rule_name ?? "",
    purchase_sum: decStr(r.purchase_sum),
    bonus_qty: decStr(r.bonus_qty),
    bonus_sum: decStr(r.bonus_sum),
    order_count: Number(r.order_count ?? 0),
    akb: Number(r.akb ?? 0),
    rules_count: Number(r.rules_count ?? 0)
  }));

  return {
    period_from: f.from,
    period_to: f.to,
    date_type: f.date_type,
    group_by: f.group_by,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals: {
      purchase_sum: decStr(rows[0]?.sum_purchase),
      bonus_qty: decStr(rows[0]?.sum_bonus_qty),
      bonus_sum: decStr(rows[0]?.sum_bonus_sum),
      order_count: Number(rows[0]?.sum_orders ?? 0),
      akb: Number(rows[0]?.sum_akb ?? 0)
    },
    rows: mapped
  };
}
