import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  isCalendarWorkingDay,
  listCalendarWorkingDays,
  listMonthDays,
  tenantMonthRangeUtc,
  ymdInTimeZone
} from "../../lib/workday-calendar";
import type { WorkdaysState } from "../tabel/workdays.service";
import {
  applyAgentNormToDays,
  consignmentOpenDays,
  parseAgentNormConfig,
  type AgentDaySales,
  type AgentNormConfig,
  type NormDay
} from "./timesheet.agent-norm.pure";
import { isGpsTrackedRole } from "./timesheet.day-status";

export type AgentNormContext = {
  cfg: AgentNormConfig;
  today: string;
  /** Kalit: `userId:YYYY-MM-DD`. */
  sales: Map<string, AgentDaySales>;
  consignmentOpen: Map<number, Set<string>>;
};

type OrderDayRow = {
  agent_id: number;
  created_at: Date;
  status: string;
  total_sum: Prisma.Decimal | null;
  returned: Prisma.Decimal | null;
};

/** Agent zakazlari kun bo‘yicha: otkaz (bekor) va vozvrat zakaz olingan kunning summasini kamaytiradi. */
async function loadAgentDaySales(
  tenantId: number,
  agentIds: number[],
  from: Date,
  to: Date,
  timeZone: string
): Promise<Map<string, AgentDaySales>> {
  const rows = await prisma.$queryRaw<OrderDayRow[]>`
    SELECT o.agent_id, o.created_at, o.status, o.total_sum, r.amount AS returned
    FROM orders o
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(sr.refund_amount, (
        SELECT SUM(
          COALESCE(srl.paid_qty, srl.qty - COALESCE(srl.bonus_qty, 0)) *
          COALESCE((
            SELECT oi.total / NULLIF(oi.qty, 0) FROM order_items oi
            WHERE oi.order_id = o.id AND oi.product_id = srl.product_id AND oi.is_bonus = false
            LIMIT 1
          ), 0)
        )
        FROM sales_return_lines srl WHERE srl.return_id = sr.id
      ), 0)) AS amount
      FROM sales_returns sr
      WHERE sr.tenant_id = o.tenant_id AND sr.order_id = o.id AND sr.status <> 'cancelled'
    ) r ON true
    WHERE o.tenant_id = ${tenantId}
      AND o.agent_id = ANY(${agentIds}::int[])
      AND o.order_type = 'order'
      AND o.created_at >= ${from} AND o.created_at < ${to}`;

  const out = new Map<string, AgentDaySales>();
  for (const r of rows) {
    const key = `${r.agent_id}:${ymdInTimeZone(r.created_at, timeZone)}`;
    const cur = out.get(key) ?? { gross: 0, refused: 0, returned: 0, orders: 0 };
    const total = Number(r.total_sum ?? 0);
    cur.gross += total;
    cur.orders += 1;
    if (r.status === "cancelled") cur.refused += total;
    else if (r.status === "returned") cur.returned += total;
    else cur.returned += Math.min(total, Math.max(0, Number(r.returned ?? 0)));
    out.set(key, cur);
  }
  return out;
}

async function loadConsignmentOpenByAgent(
  tenantId: number,
  agents: Array<{ id: number; consignment: boolean }>,
  to: Date,
  days: string[],
  timeZone: string
): Promise<Map<number, Set<string>>> {
  const logs = await prisma.userConsignmentLog.findMany({
    where: { tenant_id: tenantId, user_id: { in: agents.map((a) => a.id) }, changed_at: { lt: to } },
    select: { user_id: true, enabled: true, changed_at: true },
    orderBy: [{ changed_at: "asc" }, { id: "asc" }]
  });
  const byUser = new Map<number, Array<{ ymd: string; enabled: boolean }>>();
  for (const l of logs) {
    const list = byUser.get(l.user_id) ?? [];
    list.push({ ymd: ymdInTimeZone(l.changed_at, timeZone), enabled: l.enabled });
    byUser.set(l.user_id, list);
  }
  const out = new Map<number, Set<string>>();
  for (const a of agents) out.set(a.id, consignmentOpenDays(byUser.get(a.id) ?? [], days, a.consignment));
  return out;
}

export async function loadAgentNormContext(
  tenantId: number,
  settings: Prisma.JsonValue | null | undefined,
  agents: Array<{ id: number; role: string; consignment: boolean }>,
  year: number,
  month: number,
  timeZone: string
): Promise<AgentNormContext> {
  const cfg = parseAgentNormConfig(settings);
  const today = ymdInTimeZone(new Date(), timeZone);
  const ctx: AgentNormContext = { cfg, today, sales: new Map(), consignmentOpen: new Map() };
  const days = listMonthDays(year, month);
  const tracked = agents.filter((a) => isGpsTrackedRole(a.role));
  if (!cfg.enabled || tracked.length === 0 || days[days.length - 1]! < cfg.start_date || days[0]! > today) {
    return ctx;
  }
  const { from, to } = tenantMonthRangeUtc(year, month, timeZone);
  const [sales, consignmentOpen] = await Promise.all([
    loadAgentDaySales(tenantId, tracked.map((a) => a.id), from, to, timeZone),
    loadConsignmentOpenByAgent(tenantId, tracked, to, days, timeZone)
  ]);
  ctx.sales = sales;
  ctx.consignmentOpen = consignmentOpen;
  return ctx;
}

/** Bitta agent oyi kunlariga normani qo‘llaydi; agent bo‘lmasa hech narsa qilmaydi. */
export function applyAgentNormForUser(
  ctx: AgentNormContext,
  user: { id: number; role: string },
  days: NormDay[],
  workdays: WorkdaysState,
  year: number,
  month: number
): void {
  if (!isGpsTrackedRole(user.role)) return;
  const open = ctx.consignmentOpen.get(user.id);
  applyAgentNormToDays(days, {
    cfg: ctx.cfg,
    today: ctx.today,
    isWorkingDay: (ymd) => isCalendarWorkingDay(workdays, user.role, user.id, ymd),
    planDays: listCalendarWorkingDays(workdays, user.role, user.id, year, month).length,
    sales: (ymd) => ctx.sales.get(`${user.id}:${ymd}`),
    consignmentOpen: (ymd) => open?.has(ymd) ?? false
  });
}
