import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { bigToNum, clampPct, decToString } from "./dashboard.helpers";
import type {
  SupervisorProductMatrixBlock,
  SupervisorProductMatrixRow,
  SupervisorProductRow
} from "./dashboard.supervisor.scope";

export type SupervisorProductAnalyticsBlocks = {
  product_analytics: {
    by_category: SupervisorProductRow[];
    by_group: SupervisorProductRow[];
    by_brand: SupervisorProductRow[];
  };
  product_matrix: {
    by_category: SupervisorProductMatrixBlock;
    by_group: SupervisorProductMatrixBlock;
    by_brand: SupervisorProductMatrixBlock;
  };
};

export async function loadSupervisorProductAnalyticsBlocks(
  orderScope: Prisma.Sql
): Promise<SupervisorProductAnalyticsBlocks> {
    const [productRowsCategory, productRowsGroup, productRowsBrand] = await Promise.all([
      prisma.$queryRaw<
        Array<{ dimension: string; revenue: Prisma.Decimal; quantity: Prisma.Decimal; akb: bigint }>
      >`
        SELECT
          COALESCE(pc.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE ${orderScope}
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 100
      `,
      prisma.$queryRaw<
        Array<{ dimension: string; revenue: Prisma.Decimal; quantity: Prisma.Decimal; akb: bigint }>
      >`
        SELECT
          COALESCE(pg.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_catalog_groups pg ON pg.id = p.product_group_id
        WHERE ${orderScope}
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 100
      `,
      prisma.$queryRaw<
        Array<{ dimension: string; revenue: Prisma.Decimal; quantity: Prisma.Decimal; akb: bigint }>
      >`
        SELECT
          COALESCE(pb.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_brands pb ON pb.id = p.brand_id
        WHERE ${orderScope}
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 100
      `
    ]);
  
    const mapProductRows = (
      rows: Array<{ dimension: string; revenue: Prisma.Decimal; quantity: Prisma.Decimal; akb: bigint }>
    ): SupervisorProductRow[] => {
      const grand = rows.reduce((s, r) => s.plus(r.revenue ?? new Prisma.Decimal(0)), new Prisma.Decimal(0));
      return rows.map((r) => {
        const rev = r.revenue ?? new Prisma.Decimal(0);
        const share = grand.gt(0) ? rev.div(grand).mul(100).toNumber() : 0;
        return {
          dimension: r.dimension || "—",
          share_pct: clampPct(share),
          revenue: decToString(rev),
          quantity: decToString(r.quantity),
          akb: bigToNum(r.akb)
        };
      });
    };
  
    type MatrixAggRow = {
      actor_id: number;
      actor_name: string;
      dimension: string;
      revenue: Prisma.Decimal;
      quantity: Prisma.Decimal;
      akb: bigint;
      orders: bigint;
    };
  
    const buildMatrix = (rows: MatrixAggRow[]): SupervisorProductMatrixBlock => {
      const dimTotals = new Map<string, Prisma.Decimal>();
      for (const r of rows) {
        const key = r.dimension || "—";
        dimTotals.set(key, (dimTotals.get(key) ?? new Prisma.Decimal(0)).plus(r.revenue ?? new Prisma.Decimal(0)));
      }
      const dimensions = Array.from(dimTotals.entries())
        .sort((a, b) => b[1].minus(a[1]).toNumber())
        .map(([k]) => k);
  
      const rowMap = new Map<number, SupervisorProductMatrixRow>();
      for (const r of rows) {
        const key = r.dimension || "—";
        const row = rowMap.get(r.actor_id) ?? { id: r.actor_id, name: r.actor_name, values: {} };
        row.values[key] = {
          revenue: decToString(r.revenue),
          quantity: decToString(r.quantity),
          akb: bigToNum(r.akb),
          orders: bigToNum(r.orders)
        };
        rowMap.set(r.actor_id, row);
      }
      const list = Array.from(rowMap.values()).sort((a, b) => a.name.localeCompare(b.name, "ru"));
      return { dimensions, by_agents: list, by_supervisors: [] };
    };
  
    const withBySupervisors = (
      byAgentsRows: MatrixAggRow[],
      bySupervisorRows: MatrixAggRow[]
    ): SupervisorProductMatrixBlock => {
      const base = buildMatrix(byAgentsRows);
      const sup = buildMatrix(bySupervisorRows);
      return {
        dimensions: base.dimensions.length >= sup.dimensions.length ? base.dimensions : sup.dimensions,
        by_agents: base.by_agents,
        by_supervisors: sup.by_agents
      };
    };
  
    const [
      categoryMatrixByAgents,
      categoryMatrixBySupervisors,
      groupMatrixByAgents,
      groupMatrixBySupervisors,
      brandMatrixByAgents,
      brandMatrixBySupervisors
    ] = await Promise.all([
      prisma.$queryRaw<MatrixAggRow[]>`
        SELECT
          ua.id AS actor_id,
          ua.name AS actor_name,
          COALESCE(pc.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb,
          COUNT(DISTINCT o.id)::bigint AS orders
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN users ua ON ua.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE ${orderScope}
        GROUP BY ua.id, ua.name, dimension
      `,
      prisma.$queryRaw<MatrixAggRow[]>`
        SELECT
          us.id AS actor_id,
          us.name AS actor_name,
          COALESCE(pc.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb,
          COUNT(DISTINCT o.id)::bigint AS orders
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN users us ON us.id = u.supervisor_user_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_categories pc ON pc.id = p.category_id
        WHERE ${orderScope}
          AND u.supervisor_user_id IS NOT NULL
        GROUP BY us.id, us.name, dimension
      `,
      prisma.$queryRaw<MatrixAggRow[]>`
        SELECT
          ua.id AS actor_id,
          ua.name AS actor_name,
          COALESCE(pg.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb,
          COUNT(DISTINCT o.id)::bigint AS orders
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN users ua ON ua.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_catalog_groups pg ON pg.id = p.product_group_id
        WHERE ${orderScope}
        GROUP BY ua.id, ua.name, dimension
      `,
      prisma.$queryRaw<MatrixAggRow[]>`
        SELECT
          us.id AS actor_id,
          us.name AS actor_name,
          COALESCE(pg.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb,
          COUNT(DISTINCT o.id)::bigint AS orders
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN users us ON us.id = u.supervisor_user_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_catalog_groups pg ON pg.id = p.product_group_id
        WHERE ${orderScope}
          AND u.supervisor_user_id IS NOT NULL
        GROUP BY us.id, us.name, dimension
      `,
      prisma.$queryRaw<MatrixAggRow[]>`
        SELECT
          ua.id AS actor_id,
          ua.name AS actor_name,
          COALESCE(pb.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb,
          COUNT(DISTINCT o.id)::bigint AS orders
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN users ua ON ua.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_brands pb ON pb.id = p.brand_id
        WHERE ${orderScope}
        GROUP BY ua.id, ua.name, dimension
      `,
      prisma.$queryRaw<MatrixAggRow[]>`
        SELECT
          us.id AS actor_id,
          us.name AS actor_name,
          COALESCE(pb.name, '—') AS dimension,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS revenue,
          COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS quantity,
          COUNT(DISTINCT o.client_id)::bigint AS akb,
          COUNT(DISTINCT o.id)::bigint AS orders
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN users us ON us.id = u.supervisor_user_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN product_brands pb ON pb.id = p.brand_id
        WHERE ${orderScope}
          AND u.supervisor_user_id IS NOT NULL
        GROUP BY us.id, us.name, dimension
      `
    ]);

  return {
    product_analytics: {
      by_category: mapProductRows(productRowsCategory),
      by_group: mapProductRows(productRowsGroup),
      by_brand: mapProductRows(productRowsBrand)
    },
    product_matrix: {
      by_category: withBySupervisors(categoryMatrixByAgents, categoryMatrixBySupervisors),
      by_group: withBySupervisors(groupMatrixByAgents, groupMatrixBySupervisors),
      by_brand: withBySupervisors(brandMatrixByAgents, brandMatrixBySupervisors)
    }
  };
}
