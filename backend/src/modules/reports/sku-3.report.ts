import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import type { Sku3Cell, Sku3Filters, Sku3ProductCol, Sku3Row } from "./sku-3.types";

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

function buildClientScopeWhere(tenantId: number, f: Sku3Filters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (f.agent_ids?.length) {
    parts.push(Prisma.sql`c.agent_id IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.client_categories?.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
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
    parts.push(Prisma.sql`c.name ILIKE ${pat}`);
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`c.agent_id`, actor));
  }
  return Prisma.join(parts, " AND ");
}

function buildOrderWhere(tenantId: number, f: Sku3Filters, actor?: ReportActor): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`o.status <> 'cancelled'`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  if (from) parts.push(Prisma.sql`o.created_at >= ${from}`);
  if (to) parts.push(Prisma.sql`o.created_at <= ${to}`);
  if (f.agent_ids?.length) {
    parts.push(Prisma.sql`COALESCE(o.agent_id, c.agent_id) IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.expeditor_ids?.length) {
    parts.push(Prisma.sql`o.expeditor_user_id IN (${Prisma.join(f.expeditor_ids)})`);
  }
  if (f.price_types?.length) {
    parts.push(Prisma.sql`COALESCE(o.price_type, '') IN (${sqlInStrings(f.price_types)})`);
  }
  if (f.client_categories?.length) {
    parts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
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
  if (f.product_ids.length) {
    parts.push(Prisma.sql`oi.product_id IN (${Prisma.join(f.product_ids)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    parts.push(Prisma.sql`c.name ILIKE ${pat}`);
  }
  if (actor) {
    parts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`COALESCE(o.agent_id, c.agent_id)`, actor));
  }
  return Prisma.join(parts, " AND ");
}

export async function getSku3Report(tenantId: number, f: Sku3Filters, actor?: ReportActor) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const emptyCell = (): Sku3Cell => ({ amount: "0.00", qty: "0" });

  if (f.product_ids.length === 0) {
    return {
      period_from: f.from,
      period_to: f.to,
      page: f.page,
      limit: f.limit,
      total: 0,
      okb: 0,
      akb: 0,
      products: [] as Sku3ProductCol[],
      rows: [] as Sku3Row[],
      need_products: true as const
    };
  }

  const clientScopeSql = buildClientScopeWhere(tenantId, f, scopedActor);
  const orderWhereSql = buildOrderWhere(tenantId, f, scopedActor);
  const offset = (f.page - 1) * f.limit;

  const products = await prisma.product.findMany({
    where: { tenant_id: tenantId, id: { in: f.product_ids } },
    select: { id: true, name: true, sku: true }
  });
  const productOrder = new Map(f.product_ids.map((id, i) => [id, i]));
  const productCols: Sku3ProductCol[] = [...products]
    .sort((a, b) => (productOrder.get(a.id) ?? 0) - (productOrder.get(b.id) ?? 0))
    .map((p) => ({ product_id: p.id, product_name: p.name, sku: p.sku }));

  const [okbRow, akbRow, clientPage] = await Promise.all([
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*)::bigint AS n FROM clients c WHERE ${clientScopeSql}
    `,
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(DISTINCT o.client_id)::bigint AS n
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${orderWhereSql}
    `,
    prisma.$queryRaw<Array<{ client_id: number; client_name: string; total_count: bigint }>>`
      WITH sold AS (
        SELECT DISTINCT o.client_id
        FROM orders o
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        WHERE ${orderWhereSql}
      )
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        COUNT(*) OVER()::bigint AS total_count
      FROM clients c
      JOIN sold s ON s.client_id = c.id
      ORDER BY c.name ASC
      LIMIT ${f.limit} OFFSET ${offset}
    `
  ]);

  const okb = Number(okbRow[0]?.n ?? 0);
  const akb = Number(akbRow[0]?.n ?? 0);
  const total = Number(clientPage[0]?.total_count ?? 0);
  const clientIds = clientPage.map((r) => r.client_id);

  type CellRaw = {
    client_id: number;
    product_id: number;
    amount: Prisma.Decimal;
    qty: Prisma.Decimal;
  };

  const cells =
    clientIds.length === 0
      ? []
      : await prisma.$queryRaw<CellRaw[]>`
          SELECT
            o.client_id,
            oi.product_id,
            COALESCE(SUM(oi.total), 0)::numeric(15,2) AS amount,
            COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS qty
          FROM orders o
          JOIN clients c ON c.id = o.client_id
          JOIN order_items oi ON oi.order_id = o.id
          WHERE ${orderWhereSql}
            AND o.client_id IN (${Prisma.join(clientIds)})
          GROUP BY o.client_id, oi.product_id
        `;

  const cellMap = new Map<string, Sku3Cell>();
  for (const r of cells) {
    cellMap.set(`${r.client_id}:${r.product_id}`, {
      amount: moneyStr(r.amount),
      qty: qtyStr(r.qty)
    });
  }

  const rows: Sku3Row[] = clientPage.map((c, idx) => {
    const rowCells: Record<string, Sku3Cell> = {};
    for (const p of productCols) {
      rowCells[String(p.product_id)] = cellMap.get(`${c.client_id}:${p.product_id}`) ?? emptyCell();
    }
    return {
      row_number: offset + idx + 1,
      client_id: c.client_id,
      client_name: c.client_name,
      cells: rowCells
    };
  });

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total,
    okb,
    akb,
    products: productCols,
    rows,
    need_products: false as const
  };
}
