import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import { buildSalesTerritoryAliasClause, salesDateExprByType } from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";

export async function fetchSalesSnapshotCoverageBlock(ctx: SalesSnapshotQueryCtx, akb: number) {
  const { tenantId, filters, salesScope, productFilter, territoryTerms } = ctx;
  const [okbRows, territorySalesRows, territoryOkbRows, agentSalesRows, agentOkbRows] = await Promise.all([
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT caa.client_id)::bigint AS c
      FROM client_agent_assignments caa
      JOIN clients c ON c.id = caa.client_id
      JOIN users u ON u.id = caa.agent_id
      WHERE caa.tenant_id = ${tenantId}
        ${filters.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(filters.supervisor_ids)})` : Prisma.empty}
        ${filters.trade_directions.length > 0 ? Prisma.sql`AND COALESCE(u.trade_direction, '') IN (${Prisma.join(filters.trade_directions)})` : Prisma.empty}
        ${buildSalesTerritoryAliasClause("c", territoryTerms)}
    `,
    prisma.$queryRaw<Array<{ territory: string; sales_sum: Prisma.Decimal; akb: bigint }>>`
      SELECT
        COALESCE(NULLIF(TRIM(c.region), ''), NULLIF(TRIM(c.city), ''), NULLIF(TRIM(c.zone), ''), '—') AS territory,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.client_id)::bigint AS akb
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1
      ORDER BY sales_sum DESC
      LIMIT 50
    `,
    prisma.$queryRaw<Array<{ territory: string; okb: bigint }>>`
      SELECT
        COALESCE(NULLIF(TRIM(c.region), ''), NULLIF(TRIM(c.city), ''), NULLIF(TRIM(c.zone), ''), '—') AS territory,
        COUNT(DISTINCT caa.client_id)::bigint AS okb
      FROM client_agent_assignments caa
      JOIN clients c ON c.id = caa.client_id
      JOIN users u ON u.id = caa.agent_id
      WHERE caa.tenant_id = ${tenantId}
        ${filters.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(filters.supervisor_ids)})` : Prisma.empty}
        ${filters.trade_directions.length > 0 ? Prisma.sql`AND COALESCE(u.trade_direction, '') IN (${Prisma.join(filters.trade_directions)})` : Prisma.empty}
        ${buildSalesTerritoryAliasClause("c", territoryTerms)}
      GROUP BY 1
    `,
    prisma.$queryRaw<
      Array<{ agent_id: number; agent_name: string; agent_code: string | null; sales_sum: Prisma.Decimal; akb: bigint }>
    >`
      SELECT
        u.id AS agent_id,
        u.name AS agent_name,
        u.code AS agent_code,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.client_id)::bigint AS akb
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY u.id, u.name, u.code
      ORDER BY sales_sum DESC
      LIMIT 200
    `,
    prisma.$queryRaw<Array<{ agent_id: number; okb: bigint }>>`
      SELECT
        caa.agent_id,
        COUNT(DISTINCT caa.client_id)::bigint AS okb
      FROM client_agent_assignments caa
      JOIN users u ON u.id = caa.agent_id
      JOIN clients c ON c.id = caa.client_id
      WHERE caa.tenant_id = ${tenantId}
        ${filters.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(filters.supervisor_ids)})` : Prisma.empty}
        ${filters.trade_directions.length > 0 ? Prisma.sql`AND COALESCE(u.trade_direction, '') IN (${Prisma.join(filters.trade_directions)})` : Prisma.empty}
        ${buildSalesTerritoryAliasClause("c", territoryTerms)}
      GROUP BY caa.agent_id
    `
  ]);
  const okb = Number(okbRows[0]?.c ?? 0n);
  const coverage = okb > 0 ? clampPct((akb / okb) * 100) : 0;

  const territoryOkbMap = new Map<string, number>(
    territoryOkbRows.map((r) => [r.territory, Number(r.okb)])
  );
  const territory_analytics = territorySalesRows.map((r) => {
    const territoryOkb = territoryOkbMap.get(r.territory) ?? 0;
    const territoryAkb = Number(r.akb);
    return {
      territory: r.territory,
      sales_sum: r.sales_sum.toString(),
      akb: territoryAkb,
      okb: territoryOkb,
      coverage_pct: territoryOkb > 0 ? clampPct((territoryAkb / territoryOkb) * 100) : 0
    };
  });
  const agentOkbMap = new Map<number, number>(agentOkbRows.map((r) => [r.agent_id, Number(r.okb)]));
  const agent_analytics = agentSalesRows.map((r) => {
    const rowOkb = agentOkbMap.get(r.agent_id) ?? 0;
    const rowAkb = Number(r.akb);
    return {
      agent_id: r.agent_id,
      agent_name: r.agent_name,
      agent_code: r.agent_code,
      sales_sum: r.sales_sum.toString(),
      akb: rowAkb,
      okb: rowOkb,
      coverage_pct: rowOkb > 0 ? clampPct((rowAkb / rowOkb) * 100) : 0
    };
  });
  return {
    akb_okb_block: { akb, okb, coverage_pct: coverage },
    territory_analytics,
    agent_analytics
  };
}
