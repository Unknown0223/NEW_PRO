import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  priceTypeEntriesFromUnknown,
  resolvePriceTypeKeyToLabel
} from "../tenant-settings/finance-refs";
import type { PricesReportFilters, PricesReportRow, PricesReportTotals } from "./prices-report.types";

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

type Raw = {
  changed_at: Date;
  product_id: number;
  product_name: string;
  sku: string;
  category_name: string | null;
  brand_name: string | null;
  price_type: string;
  price: Prisma.Decimal;
  currency: string;
  previous_price: Prisma.Decimal | null;
  diff: Prisma.Decimal | null;
  total_count: bigint;
  sum_changes: bigint;
  sum_products: bigint;
};

export async function getPricesReport(tenantId: number, f: PricesReportFilters) {
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const offset = (f.page - 1) * f.limit;

  const histParts: Prisma.Sql[] = [
    Prisma.sql`s.tenant_id = ${tenantId}`,
    Prisma.sql`s.status = 'applied'`,
    Prisma.sql`p.tenant_id = ${tenantId}`
  ];
  if (f.price_types.length) {
    histParts.push(Prisma.sql`s.price_type IN (${sqlInStrings(f.price_types)})`);
  }
  if (f.category_ids.length) {
    histParts.push(Prisma.sql`p.category_id IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.brand_ids.length) {
    histParts.push(Prisma.sql`p.brand_id IN (${Prisma.join(f.brand_ids)})`);
  }
  if (f.product_ids.length) {
    histParts.push(Prisma.sql`s.product_id IN (${Prisma.join(f.product_ids)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    histParts.push(
      Prisma.sql`(
        COALESCE(p.name, '') ILIKE ${pat}
        OR COALESCE(p.sku, '') ILIKE ${pat}
        OR COALESCE(p.barcode, '') ILIKE ${pat}
      )`
    );
  }
  const histWhere = Prisma.join(histParts, " AND ");
  const rangeParts: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (from) rangeParts.push(Prisma.sql`h.changed_at >= ${from}`);
  if (to) rangeParts.push(Prisma.sql`h.changed_at <= ${to}`);
  const rangeWhere = Prisma.join(rangeParts, " AND ");

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH hist AS (
      SELECT
        COALESCE(s.applied_at, s.effective_at) AS changed_at,
        s.product_id,
        p.name AS product_name,
        p.sku,
        c.name AS category_name,
        b.name AS brand_name,
        s.price_type,
        s.price,
        s.currency,
        LAG(s.price) OVER (
          PARTITION BY s.product_id, s.price_type
          ORDER BY COALESCE(s.applied_at, s.effective_at) ASC, s.id ASC
        ) AS previous_price
      FROM product_price_schedules s
      JOIN products p ON p.id = s.product_id
      LEFT JOIN product_categories c ON c.id = p.category_id AND c.tenant_id = p.tenant_id
      LEFT JOIN product_brands b ON b.id = p.brand_id AND b.tenant_id = p.tenant_id
      WHERE ${histWhere}
    ),
    with_diff AS (
      SELECT
        h.*,
        CASE
          WHEN h.previous_price IS NULL THEN NULL
          ELSE (h.price - h.previous_price)
        END AS diff
      FROM hist h
      WHERE ${rangeWhere}
    ),
    totals AS (
      SELECT
        COUNT(*)::bigint AS sum_changes,
        COUNT(DISTINCT product_id)::bigint AS sum_products
      FROM with_diff
    )
    SELECT
      w.*,
      COUNT(*) OVER()::bigint AS total_count,
      t.sum_changes,
      t.sum_products
    FROM with_diff w
    CROSS JOIN totals t
    ORDER BY w.changed_at DESC, w.product_name ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const refs =
    tenant && tenant.settings && typeof tenant.settings === "object"
      ? ((tenant.settings as Record<string, unknown>).references as Record<string, unknown> | undefined) ?? {}
      : {};
  const entries = priceTypeEntriesFromUnknown(refs.price_type_entries);

  const mapped: PricesReportRow[] = rows.map((r, idx) => {
    const key = r.price_type ?? "";
    const label = resolvePriceTypeKeyToLabel(key, entries) ?? key;
    const changed =
      r.changed_at instanceof Date
        ? r.changed_at.toISOString()
        : String(r.changed_at);
    return {
      row_number: offset + idx + 1,
      changed_at: changed,
      product_id: r.product_id,
      product_name: r.product_name ?? "",
      sku: r.sku ?? "",
      category_name: r.category_name ?? "",
      brand_name: r.brand_name ?? "",
      price_type: key,
      price_type_label: label,
      price: decStr(r.price),
      currency: r.currency ?? "UZS",
      previous_price: r.previous_price == null ? null : decStr(r.previous_price),
      diff: r.diff == null ? null : decStr(r.diff)
    };
  });

  const totals: PricesReportTotals = {
    change_count: Number(rows[0]?.sum_changes ?? 0),
    product_count: Number(rows[0]?.sum_products ?? 0)
  };

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals,
    rows: mapped
  };
}
