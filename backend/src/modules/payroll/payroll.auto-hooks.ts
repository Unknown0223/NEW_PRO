import type { FastifyInstance, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { subscribeOrderEvents } from "../../lib/order-event-bus";
import { currentPayrollMonth, enabledCached, markPayrollDirty, prevYm, ymOfInstant, type DirtyTarget } from "./payroll.dirty";

const ORDER_DEBOUNCE_MS = 3000;
const pendingOrders = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Zakaz o'zgarishi (order event bus): agent, ekspeditor va agentning supervayzeri oyligi eskiradi.
 * Yetkazish oyi ochiq oylardan tashqarida bo'lsa, shu oy ham belgilanadi (muzlatilgan bo'lsa → Корректировка).
 */
async function onOrderChanged(tenantId: number, orderId: number): Promise<void> {
  if (!(await enabledCached(tenantId))) return;
  const rows = await prisma.$queryRaw<
    Array<{ agent_id: number | null; expeditor_user_id: number | null; sup: number | null; delivered_at: Date | null }>
  >(Prisma.sql`
    SELECT o.agent_id, o.expeditor_user_id, a.supervisor_user_id AS sup,
      (SELECT MAX(l.created_at) FROM order_status_logs l
        WHERE l.order_id = o.id AND l.to_status = 'delivered' AND l.superseded_at IS NULL) AS delivered_at
    FROM orders o
    LEFT JOIN users a ON a.id = o.agent_id
    WHERE o.id = ${orderId} AND o.tenant_id = ${tenantId}`);
  const r = rows[0];
  if (!r) return;
  const userIds = [r.agent_id, r.expeditor_user_id, r.sup].filter((x): x is number => x != null);
  if (!userIds.length) return;
  await markPayrollDirty(tenantId, { userIds }, "order");
  if (r.delivered_at) {
    const ym = await ymOfInstant(tenantId, r.delivered_at);
    const cur = await currentPayrollMonth(tenantId);
    const prev = prevYm(cur);
    const isOpen = [cur, prev].some((x) => x.year === ym.year && x.month === ym.month);
    if (!isOpen) await markPayrollDirty(tenantId, { userIds, ...ym }, "order_late");
  }
}

export function startPayrollOrderHook(): () => void {
  return subscribeOrderEvents((p) => {
    const key = `${p.tenant_id}:${p.order_id}`;
    const prev = pendingOrders.get(key);
    if (prev) clearTimeout(prev);
    pendingOrders.set(
      key,
      setTimeout(() => {
        pendingOrders.delete(key);
        void onOrderChanged(p.tenant_id, p.order_id).catch((e) =>
          console.error("[payroll] order hook failed", { orderId: p.order_id, err: e instanceof Error ? e.message : e })
        );
      }, ORDER_DEBOUNCE_MS)
    );
  });
}

type Rule = { re: RegExp; reason: string; target: (m: RegExpMatchArray, req: FastifyRequest) => DirtyTarget };
const tenantWide = (): DirtyTarget => ({});
const userFromMatch = (m: RegExpMatchArray): DirtyTarget => {
  const id = Number(m[1]);
  return Number.isInteger(id) && id > 0 ? { userIds: [id] } : {};
};

/** Birinchi mos qoida ishlaydi. Zakazlar order event bus orqali alohida. */
const RULES: Rule[] = [
  {
    re: /^\/api\/[^/]+\/returns(\/(period|period-batch|full-order|\d+\/(accept|reject)|daily-waybills\/[^/]+\/[^/]+\/accept))?$/,
    reason: "returns",
    target: tenantWide
  },
  {
    re: /^\/api\/[^/]+\/timesheet\/(\d+)\/(\d{4})-(\d{2})-\d{2}$/,
    reason: "timesheet",
    target: (m) => ({ userIds: [Number(m[1])], year: Number(m[2]), month: Number(m[3]) })
  },
  { re: /^\/api\/[^/]+\/timesheet\/batch$/, reason: "timesheet", target: tenantWide },
  { re: /^\/api\/[^/]+\/workdays(\/|$)/, reason: "workdays", target: tenantWide },
  { re: /^\/api\/[^/]+\/plans\/setup(\/|$)/, reason: "plans", target: tenantWide },
  { re: /^\/api\/[^/]+\/kpi-groups(\/|$)/, reason: "kpi_groups", target: tenantWide },
  { re: /^\/api\/[^/]+\/products\/(bulk-kpi-group|bulk|import-catalog[^/]*)(\/|$)/, reason: "catalog", target: tenantWide },
  { re: /^\/api\/[^/]+\/products\/\d+$/, reason: "catalog", target: tenantWide },
  { re: /^\/api\/[^/]+\/(?:agents|expeditors|supervisors)\/(\d+)(?:\/|$)(?!sessions)/, reason: "staff", target: userFromMatch },
  { re: /^\/api\/[^/]+\/(?:agents|expeditors|supervisors)(\/bulk)?$/, reason: "staff", target: tenantWide },
  { re: /^\/api\/[^/]+\/access\/users\/(\d+)$/, reason: "staff", target: userFromMatch },
  { re: /^\/api\/[^/]+\/access\/users-bulk-patch$/, reason: "staff", target: tenantWide },
  { re: /^\/api\/[^/]+\/staff\/users\/(\d+)(\/|$)(?!face-reference)/, reason: "staff", target: userFromMatch },
  { re: /^\/api\/[^/]+\/work-slots(\/|$)/, reason: "work_slots", target: tenantWide },
  { re: /^\/api\/[^/]+\/clients\/merge$/, reason: "clients_merge", target: tenantWide }
];

type TimesheetCell = { userId: number; year: number; month: number };

/** Tabel saqlanganda shu xodim va oyni darhol qayta hisoblash (navbat 2 daqiqa kutmasin). */
function timesheetCells(path: string, req: FastifyRequest): TimesheetCell[] | null {
  const one = path.match(/^\/api\/[^/]+\/timesheet\/(\d+)\/(\d{4})-(\d{2})-\d{2}$/);
  if (one) return [{ userId: Number(one[1]), year: Number(one[2]), month: Number(one[3]) }];
  if (!/^\/api\/[^/]+\/timesheet\/batch$/.test(path)) return null;
  const entries = (req.body as { entries?: Array<{ userId?: unknown; date?: unknown }> } | null)?.entries;
  if (!Array.isArray(entries)) return [];
  const map = new Map<string, TimesheetCell>();
  for (const e of entries) {
    const userId = Number(e?.userId);
    const ym = typeof e?.date === "string" ? /^(\d{4})-(\d{2})-\d{2}$/.exec(e.date) : null;
    if (!Number.isInteger(userId) || userId <= 0 || !ym) continue;
    const cell = { userId, year: Number(ym[1]), month: Number(ym[2]) };
    map.set(`${cell.userId}:${cell.year}-${cell.month}`, cell);
  }
  return [...map.values()];
}

async function recalcTimesheet(tenantId: number, cells: TimesheetCell[]): Promise<void> {
  const groups = new Map<string, { year: number; month: number; ids: number[] }>();
  for (const c of cells.slice(0, 300)) {
    const key = `${c.year}-${c.month}`;
    const g = groups.get(key) ?? { year: c.year, month: c.month, ids: [] };
    if (!g.ids.includes(c.userId)) g.ids.push(c.userId);
    groups.set(key, g);
  }
  for (const g of groups.values()) {
    await markPayrollDirty(tenantId, { userIds: g.ids, year: g.year, month: g.month }, "timesheet");
  }
}

/** Muvaffaqiyatli o'zgartiruvchi so'rovlardan keyin oylikni «eskirgan» deb belgilash (fire-and-forget). */
export function registerPayrollMutationHook(app: FastifyInstance): void {
  app.addHook("onResponse", async (request, reply) => {
    if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return;
    if (reply.statusCode >= 400) return;
    const tenantId = request.tenant?.id;
    if (!tenantId) return;
    const path = request.url.split("?")[0] ?? "";
    const cells = timesheetCells(path, request);
    if (cells?.length) {
      void recalcTimesheet(tenantId, cells);
      return;
    }
    for (const rule of RULES) {
      const m = path.match(rule.re);
      if (!m) continue;
      void markPayrollDirty(tenantId, rule.target(m, request), rule.reason);
      return;
    }
  });
}
