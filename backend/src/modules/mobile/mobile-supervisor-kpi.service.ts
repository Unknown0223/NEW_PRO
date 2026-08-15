import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { getMobileAgentKpi, type MobileAgentKpiResult } from "./mobile-agent-kpi.service";
import { workRegionTodayKey } from "./mobile-agent-sync.config.service";

export type SupervisorLinkedAgent = {
  id: number;
  name: string;
  code: string | null;
  login: string;
};

export async function listSupervisorLinkedAgents(
  tenantId: number,
  supervisorUserId: number
): Promise<SupervisorLinkedAgent[]> {
  const rows = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      supervisor_user_id: supervisorUserId
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      login: true,
      code: true,
      name: true,
      first_name: true,
      last_name: true,
      middle_name: true
    }
  });
  return rows.map((u) => ({
    id: u.id,
    name: toFio(u),
    code: u.code,
    login: u.login
  }));
}

export async function assertAgentLinkedToSupervisor(
  tenantId: number,
  supervisorUserId: number,
  agentId: number
): Promise<boolean> {
  const n = await prisma.user.count({
    where: {
      id: agentId,
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      supervisor_user_id: supervisorUserId
    }
  });
  return n > 0;
}

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}

function avgPct(values: Array<number | null | undefined>): number | null {
  const xs = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (xs.length === 0) return null;
  return Math.round((sum(xs) / xs.length) * 10) / 10;
}

function dayStatus(plan: number, fact: number, isFuture: boolean, isWorking: boolean): string {
  if (isFuture) return "future";
  if (!isWorking && plan <= 0 && fact <= 0) return "off";
  if (plan <= 0) return fact > 0 ? "over" : "empty";
  const pct = fact / plan;
  if (pct >= 1) return "done";
  if (pct >= 0.7) return "good";
  if (pct > 0) return "partial";
  return "miss";
}

type AgentShareRow = {
  id: number;
  name: string;
  code: string | null;
  sales_sum: number;
  plan_sum: number;
  execution_pct: number | null;
  share_pct: number;
};

/** Jamoa KPI — faqat bog‘langan agentlar yig‘indisi + taqsimot. */
export async function getSupervisorTeamKpi(
  tenantId: number,
  supervisorUserId: number,
  monthInput?: string
): Promise<{
  period: { month: string; today: string };
  agents: Array<{ id: number; name: string; code: string | null; kpi: MobileAgentKpiResult }>;
  team: {
    agent_count: number;
    today: {
      sales_sum: number;
      plan_day_sum: number;
      execution_pct: number | null;
      remaining_sum: number;
      visits: number;
      orders_count: number;
    };
    month: {
      plan_sum: number;
      fact_sum: number;
      execution_pct: number | null;
      remaining_sum: number;
      has_plans: boolean;
    };
    week: Array<{
      date: string;
      weekday: number;
      sales_sum: number;
      plan_sum: number;
      execution_pct: number | null;
    }>;
    distribution: {
      today: AgentShareRow[];
      month: AgentShareRow[];
    };
    daily_route: {
      working_days_total: number;
      remaining_working_days: number;
      today_plan_sum: number;
      carry_forward_sum: number;
      days: Array<{
        date: string;
        is_working_day: boolean;
        is_today: boolean;
        is_future: boolean;
        plan_sum: number;
        fact_sum: number;
        execution_pct: number | null;
        remaining_sum: number;
        status: string;
      }>;
    };
  };
}> {
  const todayKey = workRegionTodayKey();
  const month = (monthInput?.trim() || todayKey.slice(0, 7));
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("BAD_MONTH");

  const agents = await listSupervisorLinkedAgents(tenantId, supervisorUserId);
  const kpis: MobileAgentKpiResult[] = [];
  // Ketma-ket emas — parallel, lekin juda ko‘p bo‘lsa chunk
  const chunk = 8;
  for (let i = 0; i < agents.length; i += chunk) {
    const slice = agents.slice(i, i + chunk);
    const part = await Promise.all(slice.map((a) => getMobileAgentKpi(tenantId, a.id, month)));
    kpis.push(...part);
  }

  const byAgent = agents.map((a, idx) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    kpi: kpis[idx]!
  }));

  const todaySales = sum(kpis.map((k) => k.today.sales_sum));
  const todayPlan = sum(kpis.map((k) => k.today.plan_day_sum));
  const monthPlan = sum(kpis.map((k) => k.month.plan_sum));
  const monthFact = sum(kpis.map((k) => k.month.fact_sum));

  // Kunlar bo‘yicha yig‘indi (birinchi agent kalendaridan)
  const dayMap = new Map<
    string,
    {
      date: string;
      is_working_day: boolean;
      is_today: boolean;
      is_future: boolean;
      plan_sum: number;
      fact_sum: number;
      remaining_sum: number;
      status: string;
    }
  >();
  for (const k of kpis) {
    for (const d of k.daily_route.days) {
      const prev = dayMap.get(d.date);
      if (!prev) {
        dayMap.set(d.date, {
          date: d.date,
          is_working_day: d.is_working_day,
          is_today: d.is_today,
          is_future: d.is_future,
          plan_sum: d.plan_sum,
          fact_sum: d.fact_sum,
          remaining_sum: d.remaining_sum,
          status: d.status
        });
      } else {
        prev.plan_sum += d.plan_sum;
        prev.fact_sum += d.fact_sum;
        prev.remaining_sum += d.remaining_sum;
        prev.is_working_day = prev.is_working_day || d.is_working_day;
      }
    }
  }
  const days = [...dayMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const execution_pct =
        d.plan_sum > 0 ? Math.round((d.fact_sum / d.plan_sum) * 1000) / 10 : null;
      return {
        ...d,
        execution_pct,
        status: dayStatus(d.plan_sum, d.fact_sum, d.is_future, d.is_working_day)
      };
    });

  // Oxirgi 7 kun — agent week yig‘indisi
  const weekMap = new Map<string, { date: string; weekday: number; sales_sum: number; plan_sum: number }>();
  for (const k of kpis) {
    for (const w of k.week ?? []) {
      const prev = weekMap.get(w.date);
      if (!prev) {
        weekMap.set(w.date, {
          date: w.date,
          weekday: w.weekday,
          sales_sum: w.sales_sum,
          plan_sum: w.plan_sum ?? 0
        });
      } else {
        prev.sales_sum += w.sales_sum;
        prev.plan_sum += w.plan_sum ?? 0;
      }
    }
  }
  const week = [...weekMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => ({
      ...w,
      execution_pct: w.plan_sum > 0 ? Math.round((w.sales_sum / w.plan_sum) * 1000) / 10 : null
    }));

  const shareRows = (
    rows: Array<{ id: number; name: string; code: string | null; sales: number; plan: number }>
  ): AgentShareRow[] => {
    const totalSales = sum(rows.map((r) => r.sales));
    return rows
      .map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        sales_sum: r.sales,
        plan_sum: r.plan,
        execution_pct: r.plan > 0 ? Math.round((r.sales / r.plan) * 1000) / 10 : null,
        share_pct: totalSales > 0 ? Math.round((r.sales / totalSales) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.sales_sum - a.sales_sum);
  };

  const todayDist = shareRows(
    byAgent.map((a) => ({
      id: a.id,
      name: a.name,
      code: a.code,
      sales: a.kpi.today.sales_sum,
      plan: a.kpi.today.plan_day_sum
    }))
  );
  const monthDist = shareRows(
    byAgent.map((a) => ({
      id: a.id,
      name: a.name,
      code: a.code,
      sales: a.kpi.month.fact_sum,
      plan: a.kpi.month.plan_sum
    }))
  );

  return {
    period: { month, today: todayKey },
    agents: byAgent,
    team: {
      agent_count: agents.length,
      today: {
        sales_sum: todaySales,
        plan_day_sum: todayPlan,
        execution_pct: todayPlan > 0 ? Math.round((todaySales / todayPlan) * 1000) / 10 : avgPct(kpis.map((k) => k.today.execution_pct)),
        remaining_sum: Math.max(0, todayPlan - todaySales),
        visits: sum(kpis.map((k) => k.today.visits)),
        orders_count: sum(kpis.map((k) => k.today.orders_count))
      },
      month: {
        plan_sum: monthPlan,
        fact_sum: monthFact,
        execution_pct: monthPlan > 0 ? Math.round((monthFact / monthPlan) * 1000) / 10 : avgPct(kpis.map((k) => k.month.execution_pct)),
        remaining_sum: Math.max(0, monthPlan - monthFact),
        has_plans: kpis.some((k) => k.month.has_plans)
      },
      week,
      distribution: { today: todayDist, month: monthDist },
      daily_route: {
        working_days_total: Math.max(0, ...kpis.map((k) => k.daily_route.working_days_total), 0),
        remaining_working_days: Math.max(0, ...kpis.map((k) => k.daily_route.remaining_working_days), 0),
        today_plan_sum: sum(kpis.map((k) => k.daily_route.today_plan_sum)),
        carry_forward_sum: sum(kpis.map((k) => k.daily_route.carry_forward_sum)),
        days
      }
    }
  };
}
