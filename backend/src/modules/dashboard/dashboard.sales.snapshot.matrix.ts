import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { CategoryMatrixRow } from "./dashboard.sales.types";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";

type Dim = "filial" | "supervisor" | "agent";

type Cell = { dim_name: string; smart_code: string; category: string; sales_sum: Prisma.Decimal };
type Tot = { dim_name: string; smart_code: string; sales_sum: Prisma.Decimal; akb: bigint };

function dimSql(dim: Dim) {
  if (dim === "filial") {
    return {
      name: Prisma.sql`COALESCE(NULLIF(TRIM(u.branch), ''), '—')`,
      code: Prisma.sql`COALESCE(NULLIF(TRIM(u.branch), ''), '')`,
      join: Prisma.empty
    };
  }
  if (dim === "supervisor") {
    return {
      name: Prisma.sql`COALESCE(NULLIF(TRIM(s.name), ''), '—')`,
      code: Prisma.sql`COALESCE(NULLIF(TRIM(s.code), ''), '')`,
      join: Prisma.sql`LEFT JOIN users s ON s.id = u.supervisor_user_id`
    };
  }
  return {
    name: Prisma.sql`COALESCE(NULLIF(TRIM(u.name), ''), '—')`,
    code: Prisma.sql`COALESCE(NULLIF(TRIM(u.code), ''), '')`,
    join: Prisma.empty
  };
}

async function loadDim(ctx: SalesSnapshotQueryCtx, dim: Dim): Promise<CategoryMatrixRow[]> {
  const { salesScope, productFilter } = ctx;
  const d = dimSql(dim);
  const [cells, totals] = await Promise.all([
    prisma.$queryRaw<Cell[]>`
      SELECT ${d.name} AS dim_name, ${d.code} AS smart_code,
        COALESCE(NULLIF(TRIM(pc.name), ''), '—') AS category,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      ${d.join}
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1, 2, 3
    `,
    prisma.$queryRaw<Tot[]>`
      SELECT ${d.name} AS dim_name, ${d.code} AS smart_code,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.client_id)::bigint AS akb
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      ${d.join}
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1, 2
    `
  ]);
  const byKey = new Map<string, CategoryMatrixRow>();
  for (const t of totals) {
    const key = `${t.dim_name}\0${t.smart_code}`;
    byKey.set(key, {
      key,
      name: t.dim_name,
      smart_code: t.smart_code,
      total: t.sales_sum.toString(),
      akb: Number(t.akb),
      amounts: {}
    });
  }
  for (const c of cells) {
    const key = `${c.dim_name}\0${c.smart_code}`;
    const row = byKey.get(key);
    if (!row) continue;
    row.amounts[c.category] = c.sales_sum.toString();
  }
  return [...byKey.values()].sort((a, b) => Number(b.total) - Number(a.total)).slice(0, 200);
}

export async function fetchSalesCategoryMatrix(ctx: SalesSnapshotQueryCtx) {
  const [filial, supervisor, agent] = await Promise.all([
    loadDim(ctx, "filial"),
    loadDim(ctx, "supervisor"),
    loadDim(ctx, "agent")
  ]);
  const names = new Set<string>();
  for (const row of [...filial, ...supervisor, ...agent]) {
    for (const name of Object.keys(row.amounts)) names.add(name);
  }
  const categories = [...names].sort((a, b) => a.localeCompare(b, "ru"));
  return { categories, by_dimension: { filial, supervisor, agent } };
}
