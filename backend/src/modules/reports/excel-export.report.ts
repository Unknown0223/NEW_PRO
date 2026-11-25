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
import { getExcelExportStatusSummaries } from "./excel-export.summaries";
import type { ExcelExportFilters, ExcelExportRow } from "./excel-export.types";

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

function dateExpr(f: ExcelExportFilters): Prisma.Sql {
  if (f.date_type === "delivered_date") {
    return Prisma.sql`COALESCE(sl.delivered_at, sl.shipped_at)`;
  }
  if (f.date_type === "shipped_date") {
    return Prisma.sql`COALESCE(sl.shipped_at, sl.delivered_at)`;
  }
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

function buildWhere(
  tenantId: number,
  f: ExcelExportFilters,
  actor?: ReportActor,
  opts?: { includeAllStatuses?: boolean }
): Prisma.Sql {
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
  if (!opts?.includeAllStatuses) {
    if (f.statuses?.length) parts.push(Prisma.sql`o.status IN (${sqlInStrings(f.statuses)})`);
    else parts.push(Prisma.sql`o.status <> 'cancelled'`);
  }
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
  if (f.product_ids?.length) {
    parts.push(Prisma.sql`p.id IN (${Prisma.join(f.product_ids)})`);
  }
  if (f.client_categories?.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.price_types?.length) {
    parts.push(Prisma.sql`COALESCE(o.price_type, '') IN (${sqlInStrings(f.price_types)})`);
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

export async function getExcelExportReport(tenantId: number, f: ExcelExportFilters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const whereSql = buildWhere(tenantId, f, scopedActor);
  const whereForCards = buildWhere(tenantId, f, scopedActor, { includeAllStatuses: true });
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
    order_id: number;
    order_number: string;
    shipped_at: Date | null;
    client_id: number;
    client_name: string;
    client_code: string | null;
    product_id: number;
    product_name: string;
    product_sku: string;
    qty: Prisma.Decimal;
    status: string;
    agent_name: string | null;
    agent_code: string | null;
    expeditor_name: string | null;
    expeditor_code: string | null;
    client_category: string | null;
    territory: string | null;
    price_type: string | null;
    payment_method_ref: string | null;
    product_category: string | null;
    unit: string | null;
    price: Prisma.Decimal;
    amount: Prisma.Decimal;
    order_date: Date;
    delivered_at: Date | null;
    total_count: bigint;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH ${STATUS_CTE}
    SELECT
      o.id AS order_id,
      o.number AS order_number,
      sl.shipped_at,
      c.id AS client_id,
      c.name AS client_name,
      COALESCE(c.client_code, '') AS client_code,
      p.id AS product_id,
      p.name AS product_name,
      p.sku AS product_sku,
      oi.qty,
      o.status,
      COALESCE(ag.name, '') AS agent_name,
      COALESCE(ag.code, '') AS agent_code,
      COALESCE(ex.name, '') AS expeditor_name,
      COALESCE(ex.code, '') AS expeditor_code,
      COALESCE(c.category, '') AS client_category,
      COALESCE(NULLIF(c.city, ''), NULLIF(c.region, ''), NULLIF(c.zone, ''), '') AS territory,
      o.price_type,
      o.payment_method_ref,
      COALESCE(pc.name, '') AS product_category,
      COALESCE(p.unit, '') AS unit,
      oi.price,
      oi.total AS amount,
      o.created_at AS order_date,
      sl.delivered_at,
      COUNT(*) OVER()::bigint AS total_count
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    JOIN order_items oi ON oi.order_id = o.id
    JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN status_logs sl ON sl.order_id = o.id
    LEFT JOIN users ag ON ag.id = COALESCE(o.agent_id, c.agent_id)
    LEFT JOIN users ex ON ex.id = o.expeditor_user_id
    WHERE ${whereSql}
    ORDER BY o.created_at DESC, o.id DESC, oi.id ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: ExcelExportRow[] = rows.map((r, idx) => {
    const pmRaw = (r.payment_method_ref ?? "").split(",")[0]?.trim() ?? "";
    const payment_method =
      paymentLabelByKey.get(pmRaw) || resolvePaymentMethodRefToLabel(pmRaw, paymentEntries) || pmRaw;
    const price_type = resolvePriceTypeKeyToLabel(r.price_type, priceEntries) || r.price_type || "";
    return {
      row_number: offset + idx + 1,
      order_id: r.order_id,
      order_number: r.order_number,
      shipped_at: r.shipped_at ? r.shipped_at.toISOString() : null,
      client_id: r.client_id,
      client_name: r.client_name,
      client_code: r.client_code ?? "",
      product_id: r.product_id,
      product_name: r.product_name,
      product_sku: r.product_sku,
      qty: qtyStr(r.qty),
      status: r.status,
      status_label: ORDER_STATUS_LABEL_RU[r.status] ?? r.status,
      agent_name: r.agent_name ?? "",
      agent_code: r.agent_code ?? "",
      expeditor_name: r.expeditor_name ?? "",
      expeditor_code: r.expeditor_code ?? "",
      client_category: r.client_category ?? "",
      territory: r.territory ?? "",
      price_type,
      payment_method,
      product_category: r.product_category ?? "",
      unit: r.unit ?? "",
      price: moneyStr(r.price),
      amount: moneyStr(r.amount),
      discount: "0.00",
      order_date: r.order_date.toISOString(),
      delivered_at: r.delivered_at ? r.delivered_at.toISOString() : null
    };
  });

  const status_summaries = await getExcelExportStatusSummaries(tenantId, whereForCards);

  return {
    period_from: f.from,
    period_to: f.to,
    date_type: f.date_type,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    rows: mapped,
    status_summaries
  };
}
