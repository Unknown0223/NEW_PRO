import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import { STATUS_CTE } from "./expeditor-returns.helpers";
import type { InventoryFilters, InventoryRow } from "./inventory.types";

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

function moneyStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0.00";
  return new Prisma.Decimal(v).toFixed(2);
}

function qtyStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return new Prisma.Decimal(v).toFixed(3).replace(/\.?0+$/, "") || "0";
}

function dateExpr(f: InventoryFilters): Prisma.Sql {
  if (f.date_type === "shipped_date") return Prisma.sql`sl.shipped_at`;
  return Prisma.sql`o.created_at`;
}

function buildClientWhere(tenantId: number, f: InventoryFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (f.client_active === "active") parts.push(Prisma.sql`c.is_active = TRUE`);
  if (f.client_active === "inactive") parts.push(Prisma.sql`c.is_active = FALSE`);
  if (f.agent_ids.length) {
    parts.push(Prisma.sql`c.agent_id IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.supervisor_ids.length) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users su
        WHERE su.id = c.agent_id
          AND su.tenant_id = ${tenantId}
          AND su.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})
      )`
    );
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
        c.name ILIKE ${pat}
        OR COALESCE(c.phone, '') ILIKE ${pat}
        OR COALESCE(c.address, '') ILIKE ${pat}
        OR COALESCE(ag.name, '') ILIKE ${pat}
      )`
    );
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`c.agent_id`, actor));
  }
  return Prisma.join(parts, " AND ");
}

function buildSalesWhere(tenantId: number, f: InventoryFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dexpr = dateExpr(f);
  if (from) parts.push(Prisma.sql`${dexpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dexpr} <= ${to}`);
  if (f.statuses.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  else parts.push(Prisma.sql`o.status <> 'cancelled'`);
  if (f.payment_methods.length) {
    parts.push(
      Prisma.sql`(
        COALESCE(o.payment_method_ref,'') IN (${sqlInStrings(f.payment_methods)})
        OR EXISTS (
          SELECT 1 FROM regexp_split_to_table(COALESCE(o.payment_method_ref, ''), ',') AS pm(v)
          WHERE btrim(pm.v) IN (${sqlInStrings(f.payment_methods)})
        )
      )`
    );
  }
  if (f.category_ids.length) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM order_items oi
        JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
        WHERE oi.order_id = o.id AND p.category_id IN (${Prisma.join(f.category_ids)})
      )`
    );
  }
  return Prisma.join(parts, " AND ");
}

export async function getInventoryReport(tenantId: number, f: InventoryFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const clientWhere = buildClientWhere(tenantId, f, scopedActor);
  const salesWhere = buildSalesWhere(tenantId, f);
  const offset = (f.page - 1) * f.limit;
  const qtyExpr = f.category_ids.length
    ? Prisma.sql`(
        SELECT COALESCE(SUM(oi.qty), 0)
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
        WHERE oi.order_id = o.id AND p.category_id IN (${Prisma.join(f.category_ids)})
      )`
    : Prisma.sql`(SELECT COALESCE(SUM(oi.qty), 0) FROM order_items oi WHERE oi.order_id = o.id)`;
  const amountExpr = f.category_ids.length
    ? Prisma.sql`(
        SELECT COALESCE(SUM(oi.total), 0)
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
        WHERE oi.order_id = o.id AND p.category_id IN (${Prisma.join(f.category_ids)})
      )`
    : Prisma.sql`COALESCE(o.total_sum, 0)`;

  type Raw = {
    client_id: number;
    client_name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    agent_name: string | null;
    supervisor_name: string | null;
    inventory_types: string | null;
    equipment_count: bigint;
    order_count: bigint;
    qty: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    total_count: bigint;
    sum_orders: bigint;
    sum_qty: Prisma.Decimal | null;
    sum_amount: Prisma.Decimal | null;
    sum_equipment: bigint;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH ${STATUS_CTE},
    eq AS (
      SELECT
        ce.client_id,
        COUNT(*)::bigint AS equipment_count,
        string_agg(DISTINCT ce.inventory_type, ', ' ORDER BY ce.inventory_type) AS inventory_types
      FROM client_equipment ce
      WHERE ce.tenant_id = ${tenantId}
        AND ce.removed_at IS NULL
        ${
          f.inventory_types.length
            ? Prisma.sql`AND ce.inventory_type IN (${sqlInStrings(f.inventory_types)})`
            : Prisma.empty
        }
      GROUP BY ce.client_id
    ),
    sales AS (
      SELECT
        o.client_id,
        COUNT(*)::bigint AS order_count,
        COALESCE(SUM(${qtyExpr}), 0) AS qty,
        COALESCE(SUM(${amountExpr}), 0) AS amount
      FROM orders o
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      WHERE ${salesWhere}
      GROUP BY o.client_id
    ),
    base AS (
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        COALESCE(c.phone, '') AS phone,
        COALESCE(c.address, '') AS address,
        COALESCE(c.city, '') AS city,
        COALESCE(ag.name, '') AS agent_name,
        COALESCE(sv.name, '') AS supervisor_name,
        COALESCE(eq.inventory_types, '') AS inventory_types,
        COALESCE(eq.equipment_count, 0)::bigint AS equipment_count,
        COALESCE(s.order_count, 0)::bigint AS order_count,
        COALESCE(s.qty, 0) AS qty,
        COALESCE(s.amount, 0) AS amount
      FROM clients c
      JOIN eq ON eq.client_id = c.id
      LEFT JOIN users ag ON ag.id = c.agent_id
      LEFT JOIN users sv ON sv.id = ag.supervisor_user_id
      LEFT JOIN sales s ON s.client_id = c.id
      WHERE ${clientWhere}
    )
    SELECT
      b.*,
      COUNT(*) OVER()::bigint AS total_count,
      COALESCE(SUM(b.order_count) OVER(), 0)::bigint AS sum_orders,
      COALESCE(SUM(b.qty) OVER(), 0) AS sum_qty,
      COALESCE(SUM(b.amount) OVER(), 0) AS sum_amount,
      COALESCE(SUM(b.equipment_count) OVER(), 0)::bigint AS sum_equipment
    FROM base b
    ORDER BY b.equipment_count DESC, b.client_name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: InventoryRow[] = rows.map((r, idx) => ({
    row_number: offset + idx + 1,
    client_id: r.client_id,
    client_name: r.client_name,
    phone: r.phone ?? "",
    address: r.address ?? "",
    city: r.city ?? "",
    agent_name: r.agent_name ?? "",
    supervisor_name: r.supervisor_name ?? "",
    inventory_types: r.inventory_types ?? "",
    equipment_count: Number(r.equipment_count),
    order_count: Number(r.order_count),
    qty: qtyStr(r.qty),
    amount: moneyStr(r.amount)
  }));

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals: {
      equipment_count: Number(rows[0]?.sum_equipment ?? 0),
      order_count: Number(rows[0]?.sum_orders ?? 0),
      qty: qtyStr(rows[0]?.sum_qty),
      amount: moneyStr(rows[0]?.sum_amount)
    },
    rows: mapped
  };
}
