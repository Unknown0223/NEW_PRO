import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  resolvePriceTypeKeyToLabel
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import { ORDER_STATUS_LABEL_RU, STATUS_CTE } from "./expeditor-returns.helpers";
import type { ShelfReturnsFilters, ShelfReturnsLineRow } from "./shelf-returns.types";

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

function dateExpr(f: ShelfReturnsFilters): Prisma.Sql {
  if (f.date_type === "delivered_date") return Prisma.sql`sl.delivered_at`;
  if (f.date_type === "shipped_date") return Prisma.sql`sl.shipped_at`;
  return Prisma.sql`o.created_at`;
}

function buildWhere(tenantId: number, f: ShelfReturnsFilters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type IN ('return', 'return_by_order')`,
    Prisma.sql`o.status <> 'cancelled'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const dexpr = dateExpr(f);
  if (from) parts.push(Prisma.sql`${dexpr} >= ${from}`);
  if (to) parts.push(Prisma.sql`${dexpr} <= ${to}`);
  if (f.statuses?.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
  if (f.agent_ids?.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.expeditor_ids?.length) {
    parts.push(Prisma.sql`o.expeditor_user_id IN (${Prisma.join(f.expeditor_ids)})`);
  }
  if (f.warehouse_ids?.length) {
    parts.push(Prisma.sql`o.warehouse_id IN (${Prisma.join(f.warehouse_ids)})`);
  }
  if (f.category_ids?.length) {
    parts.push(Prisma.sql`p.category_id IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.client_categories?.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.payment_methods?.length) {
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
  if (f.price_types?.length) {
    parts.push(Prisma.sql`COALESCE(o.price_type, '') IN (${sqlInStrings(f.price_types)})`);
  }
  if (f.territory_1_list?.length) {
    parts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list?.length) {
    parts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list?.length) {
    parts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    const idTry = Number.parseInt(search, 10);
    if (Number.isFinite(idTry) && String(idTry) === search) {
      parts.push(
        Prisma.sql`(o.id = ${idTry} OR o.number ILIKE ${pat} OR c.name ILIKE ${pat} OR p.name ILIKE ${pat} OR p.sku ILIKE ${pat})`
      );
    } else {
      parts.push(
        Prisma.sql`(o.number ILIKE ${pat} OR c.name ILIKE ${pat} OR p.name ILIKE ${pat} OR p.sku ILIKE ${pat})`
      );
    }
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return new Prisma.Decimal(v).toFixed(3).replace(/\.?0+$/, "") || "0";
}

function moneyStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0.00";
  return new Prisma.Decimal(v).toFixed(2);
}

export async function getShelfReturnsReport(tenantId: number, f: ShelfReturnsFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const currencyEntries = resolveCurrencyEntries(refs);
  const paymentEntries = resolvePaymentMethodEntries(refs, currencyEntries);
  const priceEntries = priceTypeEntriesFromUnknown(refs.price_type_entries);
  const paymentLabelByKey = new Map(
    paymentEntries.map((e) => [paymentMethodStorageKey(e), e.name.trim()] as const)
  );

  type Raw = {
    client_id: number;
    client_name: string;
    client_code: string | null;
    client_legal_name: string | null;
    client_category: string | null;
    territory: string | null;
    qty: Prisma.Decimal;
    expeditor_name: string | null;
    order_id: number;
    order_number: string;
    payment_method_ref: string | null;
    price_type: string | null;
    warehouse_name: string | null;
    order_date: Date;
    shipped_at: Date | null;
    status: string;
    trade_direction: string | null;
    volume: Prisma.Decimal;
    amount: Prisma.Decimal;
    agent_name: string | null;
    agent_code: string | null;
    supervisor_name: string | null;
    supervisor_code: string | null;
    product_id: number;
    product_sku: string;
    product_name: string;
    product_group: string | null;
    product_category: string | null;
    pack_qty: number | null;
    product_volume: Prisma.Decimal | null;
    return_reason: string | null;
    total_count: bigint;
    sum_amount: Prisma.Decimal;
    sum_qty: Prisma.Decimal;
    sum_volume: Prisma.Decimal;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH ${STATUS_CTE},
    lines AS (
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        COALESCE(c.client_code, '') AS client_code,
        COALESCE(c.legal_name, '') AS client_legal_name,
        COALESCE(c.category, '') AS client_category,
        COALESCE(NULLIF(c.city, ''), NULLIF(c.region, ''), NULLIF(c.zone, ''), '') AS territory,
        oi.qty,
        COALESCE(ex.name, '') AS expeditor_name,
        o.id AS order_id,
        o.number AS order_number,
        o.payment_method_ref,
        o.price_type,
        COALESCE(w.name, '') AS warehouse_name,
        o.created_at AS order_date,
        sl.shipped_at,
        o.status,
        COALESCE(NULLIF(ag.trade_direction, ''), NULLIF(td.name, ''), '') AS trade_direction,
        (oi.qty * COALESCE(p.volume_m3, 0))::numeric(18,6) AS volume,
        oi.total AS amount,
        COALESCE(ag.name, '') AS agent_name,
        COALESCE(ag.code, '') AS agent_code,
        COALESCE(sv.name, '') AS supervisor_name,
        COALESCE(sv.code, '') AS supervisor_code,
        p.id AS product_id,
        p.sku AS product_sku,
        p.name AS product_name,
        COALESCE(pg.name, '') AS product_group,
        COALESCE(pc.name, '') AS product_category,
        p.qty_per_block AS pack_qty,
        p.volume_m3 AS product_volume,
        COALESCE(o.request_type_ref, '') AS return_reason
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      LEFT JOIN warehouses w ON w.id = o.warehouse_id
      LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id)
      LEFT JOIN users ex ON ex.id = o.expeditor_user_id
      LEFT JOIN users sv ON sv.id = ag.supervisor_user_id
      LEFT JOIN trade_directions td ON td.id = ag.trade_direction_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN product_catalog_groups pg ON pg.id = p.product_group_id
      WHERE ${whereSql}
    )
    SELECT
      l.*,
      COUNT(*) OVER()::bigint AS total_count,
      COALESCE(SUM(l.amount) OVER(), 0)::numeric(15,2) AS sum_amount,
      COALESCE(SUM(l.qty) OVER(), 0)::numeric(15,3) AS sum_qty,
      COALESCE(SUM(l.volume) OVER(), 0)::numeric(18,6) AS sum_volume
    FROM lines l
    ORDER BY l.order_date DESC, l.order_id DESC, l.product_id ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const total = Number(rows[0]?.total_count ?? 0);
  const mapped: ShelfReturnsLineRow[] = rows.map((r, idx) => {
    const pmRaw = (r.payment_method_ref ?? "").split(",")[0]?.trim() ?? "";
    const payment_method =
      paymentLabelByKey.get(pmRaw) ||
      resolvePaymentMethodRefToLabel(pmRaw, paymentEntries) ||
      pmRaw;
    const price_type = resolvePriceTypeKeyToLabel(r.price_type, priceEntries) || r.price_type || "";
    return {
      row_number: offset + idx + 1,
      client_id: r.client_id,
      client_name: r.client_name,
      client_code: r.client_code ?? "",
      client_legal_name: r.client_legal_name ?? "",
      client_category: r.client_category ?? "",
      territory: r.territory ?? "",
      qty: decStr(r.qty),
      expeditor_name: r.expeditor_name ?? "",
      order_id: r.order_id,
      order_number: r.order_number,
      payment_method,
      price_type,
      warehouse_name: r.warehouse_name ?? "",
      order_date: r.order_date.toISOString(),
      shipped_at: r.shipped_at ? r.shipped_at.toISOString() : null,
      status: r.status,
      status_label: ORDER_STATUS_LABEL_RU[r.status] ?? r.status,
      trade_direction: r.trade_direction ?? "",
      volume: decStr(r.volume),
      amount: moneyStr(r.amount),
      agent_name: r.agent_name ?? "",
      agent_code: r.agent_code ?? "",
      supervisor_name: r.supervisor_name ?? "",
      supervisor_code: r.supervisor_code ?? "",
      product_id: r.product_id,
      product_sku: r.product_sku,
      product_name: r.product_name,
      product_group: r.product_group ?? "",
      product_category: r.product_category ?? "",
      pack_qty: String(r.pack_qty ?? 0),
      product_volume: decStr(r.product_volume),
      return_reason: r.return_reason ?? ""
    };
  });

  return {
    period_from: f.from,
    period_to: f.to,
    date_type: f.date_type,
    page: f.page,
    limit: f.limit,
    total,
    totals: {
      amount: moneyStr(rows[0]?.sum_amount),
      qty: decStr(rows[0]?.sum_qty),
      volume: decStr(rows[0]?.sum_volume)
    },
    rows: mapped
  };
}
