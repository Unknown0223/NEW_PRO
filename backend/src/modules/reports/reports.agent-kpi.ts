import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import { parseDateRange } from "./reports.shared";
import {
  executionPctFromPlanFact,
  loadMonitoringPlanAggregates
} from "../plans/plans.monitoring-aggregates";

export async function getAgentKpi(
  tenantId: number,
  from?: string,
  to?: string
): Promise<{
  data: Array<{
    user_id: number;
    user_name: string;
    role: string;
    clients_count: number;
    order_count: number;
    total_orders: string;
    avg_order_sum: string;
    plan_sum: string;
    execution_pct: number | null;
    returns_count: number;
    exchange_minus_qty: string;
    exchange_plus_qty: string;
    net_exchange_qty: string;
  }>;
}> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 30 * 86400000);
  const end = range.lte ?? new Date();
  const month = end.getUTCMonth() + 1;
  const year = end.getUTCFullYear();

  const planAgg = await loadMonitoringPlanAggregates(
    tenantId,
    month,
    year,
    {
      tenantId,
      agent_ids: [],
      supervisor_ids: [],
      branch_codes: [],
      territory_1_list: [],
      territory_2_list: [],
      territory_3_list: [],
      territory_terms: []
    }
  );

  const agents = await prisma.user.findMany({
    where: { tenant_id: tenantId, role: "agent", is_active: true },
    select: { id: true, name: true },
    orderBy: { id: "asc" }
  });

  if (agents.length === 0) {
    return { data: [] };
  }

  const agentIds = agents.map((a) => a.id);

  // Order stats per agent
  const orderStats = await prisma.$queryRaw<
    Array<{ agent_id: number; order_count: bigint; total_sum: Prisma.Decimal }>
  >`
    SELECT agent_id, COUNT(*)::bigint AS order_count, COALESCE(SUM(total_sum), 0)::numeric(15,2) AS total_sum
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${start}
      AND created_at <= ${end}
      AND agent_id IS NOT NULL
      AND agent_id IN (${Prisma.join(agentIds)})
    GROUP BY agent_id
  `;

  // Client count per agent
  const clientStats = await prisma.$queryRaw<
    Array<{ agent_id: number; cnt: bigint }>
  >`
    SELECT agent_id, COUNT(*)::bigint AS cnt
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND agent_id IS NOT NULL
      AND agent_id IN (${Prisma.join(agentIds)})
      AND is_active = true
    GROUP BY agent_id
  `;

  // Returns per agent (via order → agent)
  const returnStats = await prisma.$queryRaw<
    Array<{ agent_id: number; returns_count: bigint }>
  >`
    SELECT o.agent_id, COUNT(DISTINCT sr.id)::bigint AS returns_count
    FROM sales_returns sr
    JOIN orders o ON o.id = sr.order_id
    WHERE o.tenant_id = ${tenantId}
      AND sr.created_at >= ${start}
      AND sr.created_at <= ${end}
      AND o.agent_id IS NOT NULL
      AND o.agent_id IN (${Prisma.join(agentIds)})
    GROUP BY o.agent_id
  `;

  const exchangeStats = await prisma.$queryRaw<
    Array<{ agent_id: number; minus_qty: Prisma.Decimal; plus_qty: Prisma.Decimal }>
  >`
    SELECT o.agent_id,
      COALESCE(SUM(CASE WHEN oi.exchange_line_kind = 'minus' THEN oi.qty ELSE 0 END), 0)::numeric(15,3) AS minus_qty,
      COALESCE(SUM(CASE WHEN oi.exchange_line_kind = 'plus' THEN oi.qty ELSE 0 END), 0)::numeric(15,3) AS plus_qty
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.tenant_id = ${tenantId}
      AND o.order_type = 'exchange'
      AND o.created_at >= ${start}
      AND o.created_at <= ${end}
      AND o.agent_id IS NOT NULL
      AND o.agent_id IN (${Prisma.join(agentIds)})
      AND oi.is_bonus = false
    GROUP BY o.agent_id
  `;

  const oMap = new Map<number, { cnt: bigint; sum: Prisma.Decimal }>(
    orderStats.map((o) => [o.agent_id, { cnt: o.order_count, sum: o.total_sum }])
  );
  const cMap = new Map<number, bigint>(
    clientStats.map((c) => [c.agent_id, c.cnt])
  );
  const rMap = new Map<number, bigint>(
    returnStats.map((r) => [r.agent_id, r.returns_count])
  );
  const exMap = new Map<number, { minus: Prisma.Decimal; plus: Prisma.Decimal }>(
    exchangeStats.map((r) => [
      r.agent_id,
      { minus: r.minus_qty ?? new Prisma.Decimal(0), plus: r.plus_qty ?? new Prisma.Decimal(0) }
    ])
  );

  return {
    data: agents.map((agent) => {
      const o = oMap.get(agent.id) ?? { cnt: 0n, sum: new Prisma.Decimal(0) };
      const cnt = Number(o.cnt);
      const avg = cnt > 0
        ? new Prisma.Decimal(o.sum).div(cnt).toFixed(2)
        : "0";
      const ex = exMap.get(agent.id);
      const minusEx = ex?.minus ?? new Prisma.Decimal(0);
      const plusEx = ex?.plus ?? new Prisma.Decimal(0);
      const netEx = plusEx.sub(minusEx);
      const planDec = planAgg.byAgent.get(agent.id) ?? new Prisma.Decimal(0);
      const factNum = Number(o.sum.toString());

      return {
        user_id: agent.id,
        user_name: agent.name,
        role: "agent",
        clients_count: Number(cMap.get(agent.id) ?? 0n),
        order_count: cnt,
        total_orders: o.sum.toString(),
        avg_order_sum: avg,
        plan_sum: planDec.toString(),
        execution_pct: executionPctFromPlanFact(planDec, factNum),
        returns_count: Number(rMap.get(agent.id) ?? 0n),
        exchange_minus_qty: minusEx.toString(),
        exchange_plus_qty: plusEx.toString(),
        net_exchange_qty: netEx.toString()
      };
    })
  };
}

/** ─── 6. Status Distribution ────────────────────────────── */

