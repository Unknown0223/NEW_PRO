/**
 * ЗАРПЛАТА — oylik ko‘rsatkichlarni (метрики) yig‘ish.
 *
 * Manbalar:
 *  - `orders` / `order_items`  → savdo summasi, zakazlar soni, hajm, faol mijozlar
 *  - `client_payments`         → inkassatsiya (inkassator / ekspeditor / agent vedoma)
 *  - `agent_visits`            → tashriflar
 *  - `sales_returns`           → qaytarishlar
 *  - `sales_kpi_plan_targets`  → plan (faqat `approved` reja)
 *  - `users.supervisor_user_id`→ jamoa ko‘rsatkichlari (supervayzer)
 *  - `timesheet`               → ishlangan kunlar (GPS + qo‘lda)
 *  - `workdays`                → me’yoriy kunlar
 *
 * Savdo ta’rifi KPI monitoringi bilan bir xil: `order_type = 'order'`,
 * oy ichida `created_at`, `cancelled` holatlar hisobga olinmaydi.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getWorkdaysState } from "../tabel/workdays.service";
import { listTimesheetMatrix } from "../timesheet/timesheet.service";
import { plannedWorkdays } from "./payroll.planned-days";
import { emptyMetrics, mergeMetrics } from "./payroll.engine";
import { toNumber } from "./payroll.money";
import type { PayrollEmployee, PayrollMetrics } from "./payroll.types";

export function monthRange(month: string): { from: Date; to: Date; month: number; year: number } {
  const [y, m] = month.split("-").map((x) => Number.parseInt(x, 10));
  return {
    from: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0)),
    to: new Date(Date.UTC(y, m, 1, 0, 0, 0)),
    month: m,
    year: y
  };
}

type AgentSalesRow = { agent_id: number; sales: Prisma.Decimal; orders: bigint | number; clients: bigint | number };
type VolumeRow = { agent_id: number; volume: Prisma.Decimal };
type PaymentRow = { user_id: number; total: Prisma.Decimal; cnt: bigint | number };
type DeliveryRow = { user_id: number; cnt: bigint | number };
type VisitRow = { agent_id: number; cnt: bigint | number };
type ReturnRow = { user_id: number; total: Prisma.Decimal };
type OpsRow = { user_id: number; cnt: bigint | number };
type PlanRow = { user_id: number; cost: Prisma.Decimal; count: Prisma.Decimal; volume: Prisma.Decimal };
type TeamRow = { supervisor_id: number; sales: Prisma.Decimal };
type TeamPlanRow = { supervisor_id: number; cost: Prisma.Decimal };
type HeadcountRow = { supervisor_id: number; cnt: bigint | number };

export async function collectPayrollMetrics(input: {
  tenantId: number;
  month: string;
  employees: PayrollEmployee[];
}): Promise<Record<number, PayrollMetrics>> {
  const { tenantId, month, employees } = input;
  const result: Record<number, PayrollMetrics> = {};
  for (const e of employees) result[e.user_id] = emptyMetrics();
  if (employees.length === 0) return result;

  const { from, to, month: mm, year: yyyy } = monthRange(month);
  const allIds = employees.map((e) => e.user_id);
  const agentIds = employees.filter((e) => e.role === "agent").map((e) => e.user_id);
  const fieldIds = employees.filter((e) => ["expeditor", "collector", "driver"].includes(e.role)).map((e) => e.user_id);
  const supervisorIds = employees.filter((e) => e.role === "supervisor").map((e) => e.user_id);
  const warehouseIds = employees
    .filter((e) => ["skladchik", "gruzchik", "storekeeper", "warehouse_manager"].includes(e.role))
    .map((e) => e.user_id);

  const [salesRows, volumeRows, collectorRows, expeditorRows, ledgerRows, deliveryRows, visitRows, returnRows] =
    await Promise.all([
      prisma.$queryRaw<AgentSalesRow[]>`
        SELECT o.agent_id,
               COALESCE(SUM(o.total_sum), 0)::numeric(18,2) AS sales,
               COUNT(*) AS orders,
               COUNT(DISTINCT o.client_id) AS clients
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(allIds)})
          AND o.order_type = 'order'
          AND o.status <> 'cancelled'
          AND o.created_at >= ${from}
          AND o.created_at < ${to}
        GROUP BY o.agent_id
      `,
      prisma.$queryRaw<VolumeRow[]>`
        SELECT o.agent_id, COALESCE(SUM(oi.qty), 0)::numeric(18,3) AS volume
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id AND oi.is_bonus = false
        WHERE o.tenant_id = ${tenantId}
          AND o.agent_id IN (${Prisma.join(allIds)})
          AND o.order_type = 'order'
          AND o.status <> 'cancelled'
          AND o.created_at >= ${from}
          AND o.created_at < ${to}
        GROUP BY o.agent_id
      `,
      prisma.$queryRaw<PaymentRow[]>`
        SELECT p.created_by_user_id AS user_id,
               COALESCE(SUM(p.amount), 0)::numeric(18,2) AS total,
               COUNT(*) AS cnt
        FROM client_payments p
        WHERE p.tenant_id = ${tenantId}
          AND p.created_by_user_id IN (${Prisma.join(allIds)})
          AND p.entry_kind = 'payment'
          AND p.deleted_at IS NULL
          AND p.created_at >= ${from}
          AND p.created_at < ${to}
        GROUP BY p.created_by_user_id
      `,
      prisma.$queryRaw<PaymentRow[]>`
        SELECT p.expeditor_user_id AS user_id,
               COALESCE(SUM(p.amount), 0)::numeric(18,2) AS total,
               COUNT(*) AS cnt
        FROM client_payments p
        WHERE p.tenant_id = ${tenantId}
          AND p.expeditor_user_id IN (${Prisma.join(allIds)})
          AND p.entry_kind = 'payment'
          AND p.deleted_at IS NULL
          AND p.created_at >= ${from}
          AND p.created_at < ${to}
        GROUP BY p.expeditor_user_id
      `,
      prisma.$queryRaw<PaymentRow[]>`
        SELECT p.ledger_agent_id AS user_id,
               COALESCE(SUM(p.amount), 0)::numeric(18,2) AS total,
               COUNT(*) AS cnt
        FROM client_payments p
        WHERE p.tenant_id = ${tenantId}
          AND p.ledger_agent_id IN (${Prisma.join(allIds)})
          AND p.entry_kind = 'payment'
          AND p.deleted_at IS NULL
          AND p.created_at >= ${from}
          AND p.created_at < ${to}
        GROUP BY p.ledger_agent_id
      `,
      prisma.$queryRaw<DeliveryRow[]>`
        SELECT o.expeditor_user_id AS user_id, COUNT(*) AS cnt
        FROM orders o
        WHERE o.tenant_id = ${tenantId}
          AND o.expeditor_user_id IN (${Prisma.join(allIds)})
          AND o.order_type = 'order'
          AND o.status = 'delivered'
          AND o.created_at >= ${from}
          AND o.created_at < ${to}
        GROUP BY o.expeditor_user_id
      `,
      prisma.$queryRaw<VisitRow[]>`
        SELECT v.agent_id, COUNT(*) AS cnt
        FROM agent_visits v
        WHERE v.tenant_id = ${tenantId}
          AND v.agent_id IN (${Prisma.join(allIds)})
          AND v.checked_in_at >= ${from}
          AND v.checked_in_at < ${to}
        GROUP BY v.agent_id
      `,
      prisma.$queryRaw<ReturnRow[]>`
        SELECT sr.created_by_user_id AS user_id,
               COALESCE(SUM(COALESCE(sr.refund_amount, 0)), 0)::numeric(18,2) AS total
        FROM sales_returns sr
        WHERE sr.tenant_id = ${tenantId}
          AND sr.created_by_user_id IN (${Prisma.join(allIds)})
          AND sr.status = 'posted'
          AND sr.created_at >= ${from}
          AND sr.created_at < ${to}
        GROUP BY sr.created_by_user_id
      `
    ]);

  const planRows = await prisma.$queryRaw<PlanRow[]>`
    SELECT t.user_id,
           COALESCE(SUM(t.cost), 0)::numeric(18,2) AS cost,
           COALESCE(SUM(t.count), 0)::numeric(18,2) AS count,
           COALESCE(SUM(t.volume), 0)::numeric(18,2) AS volume
    FROM sales_kpi_plan_targets t
    JOIN sales_kpi_plans p ON p.id = t.plan_id
    WHERE p.tenant_id = ${tenantId}
      AND p.month = ${mm}
      AND p.year = ${yyyy}
      AND p.status = 'approved'
      AND t.user_id IN (${Prisma.join(allIds)})
    GROUP BY t.user_id
  `;

  const [teamRows, teamPlanRows, headcountRows, opsRows, blockRows] = await Promise.all([
    supervisorIds.length > 0
      ? prisma.$queryRaw<TeamRow[]>`
          SELECT u.supervisor_user_id AS supervisor_id,
                 COALESCE(SUM(o.total_sum), 0)::numeric(18,2) AS sales
          FROM orders o
          JOIN users u ON u.id = o.agent_id
          WHERE o.tenant_id = ${tenantId}
            AND u.supervisor_user_id IN (${Prisma.join(supervisorIds)})
            AND o.order_type = 'order'
            AND o.status <> 'cancelled'
            AND o.created_at >= ${from}
            AND o.created_at < ${to}
          GROUP BY u.supervisor_user_id
        `
      : Promise.resolve([] as TeamRow[]),
    supervisorIds.length > 0
      ? prisma.$queryRaw<TeamPlanRow[]>`
          SELECT u.supervisor_user_id AS supervisor_id, COALESCE(SUM(t.cost), 0)::numeric(18,2) AS cost
          FROM sales_kpi_plan_targets t
          JOIN sales_kpi_plans p ON p.id = t.plan_id
          JOIN users u ON u.id = t.user_id
          WHERE p.tenant_id = ${tenantId}
            AND p.month = ${mm}
            AND p.year = ${yyyy}
            AND p.status = 'approved'
            AND u.supervisor_user_id IN (${Prisma.join(supervisorIds)})
          GROUP BY u.supervisor_user_id
        `
      : Promise.resolve([] as TeamPlanRow[]),
    supervisorIds.length > 0
      ? prisma.$queryRaw<HeadcountRow[]>`
          SELECT u.supervisor_user_id AS supervisor_id, COUNT(*) AS cnt
          FROM users u
          WHERE u.tenant_id = ${tenantId}
            AND u.supervisor_user_id IN (${Prisma.join(supervisorIds)})
            AND u.is_active = true
          GROUP BY u.supervisor_user_id
        `
      : Promise.resolve([] as HeadcountRow[]),
    warehouseIds.length > 0
      ? prisma.$queryRaw<OpsRow[]>`
          SELECT g.created_by_user_id AS user_id, COUNT(*) AS cnt
          FROM goods_receipts g
          WHERE g.tenant_id = ${tenantId}
            AND g.created_by_user_id IN (${Prisma.join(warehouseIds)})
            AND g.deleted_at IS NULL
            AND g.status = 'posted'
            AND g.created_at >= ${from}
            AND g.created_at < ${to}
          GROUP BY g.created_by_user_id
        `
      : Promise.resolve([] as OpsRow[]),
    warehouseIds.length > 0
      ? prisma.$queryRaw<OpsRow[]>`
          SELECT wb.gruzchik_user_id AS user_id, COUNT(*) AS cnt
          FROM orders o
          JOIN warehouse_blocks wb ON wb.id = o.warehouse_block_id
          WHERE o.tenant_id = ${tenantId}
            AND wb.gruzchik_user_id IN (${Prisma.join(warehouseIds)})
            AND o.order_type = 'order'
            AND o.created_at >= ${from}
            AND o.created_at < ${to}
          GROUP BY wb.gruzchik_user_id
        `
      : Promise.resolve([] as OpsRow[])
  ]);

  const [timesheet, workdays] = await Promise.all([
    listTimesheetMatrix(tenantId, { month }).catch(() => null),
    getWorkdaysState(tenantId).catch(() => null)
  ]);
  const workedByUser = new Map<number, number>();
  for (const row of timesheet?.rows ?? []) workedByUser.set(row.user_id, row.worked_days);
  const workdaysSnapshot = workdays
    ? {
        schedules: workdays.schedules,
        exceptions: workdays.exceptions.map((e) => ({ role: e.role, date: e.date, type: e.type })),
        overrides: workdays.overrides.map((o) => ({ employeeId: o.employeeId, schedule: o.schedule }))
      }
    : null;

  const patch = (userId: number, part: Partial<PayrollMetrics>) => {
    result[userId] = mergeMetrics(result[userId], part);
  };

  for (const r of salesRows) {
    patch(r.agent_id, {
      sales_sum: toNumber(r.sales),
      sales_count: Number(r.orders),
      active_clients: Number(r.clients)
    });
  }
  for (const r of volumeRows) patch(r.agent_id, { sales_volume: toNumber(r.volume) });
  for (const r of collectorRows) patch(r.user_id, { collection_sum: toNumber(r.total), collection_count: Number(r.cnt) });
  for (const r of expeditorRows) {
    const cur = result[r.user_id] ?? emptyMetrics();
    patch(r.user_id, {
      collection_sum: cur.collection_sum + toNumber(r.total),
      collection_count: cur.collection_count + Number(r.cnt)
    });
  }
  // Agent uchun inkassatsiya — vedoma (`ledger_agent_id`) bo‘yicha, agar boshqa manba bo‘lmasa.
  for (const r of ledgerRows) {
    if (!agentIds.includes(r.user_id)) continue;
    const cur = result[r.user_id] ?? emptyMetrics();
    if (cur.collection_sum > 0) continue;
    patch(r.user_id, { collection_sum: toNumber(r.total), collection_count: Number(r.cnt) });
  }
  for (const r of deliveryRows) patch(r.user_id, { deliveries: Number(r.cnt) });
  for (const r of visitRows) patch(r.agent_id, { visits: Number(r.cnt) });
  for (const r of returnRows) patch(r.user_id, { returns_sum: toNumber(r.total) });
  for (const r of planRows) {
    patch(r.user_id, {
      plan_sum: toNumber(r.cost),
      plan_count: toNumber(r.count),
      plan_volume: toNumber(r.volume)
    });
  }
  for (const r of teamRows) patch(r.supervisor_id, { team_sales_sum: toNumber(r.sales) });
  for (const r of teamPlanRows) patch(r.supervisor_id, { team_plan_sum: toNumber(r.cost) });
  for (const r of headcountRows) patch(r.supervisor_id, { team_headcount: Number(r.cnt) });
  for (const r of opsRows) {
    const cur = result[r.user_id] ?? emptyMetrics();
    patch(r.user_id, { warehouse_ops: cur.warehouse_ops + Number(r.cnt) });
  }
  for (const r of blockRows) {
    const cur = result[r.user_id] ?? emptyMetrics();
    patch(r.user_id, { warehouse_ops: cur.warehouse_ops + Number(r.cnt) });
  }

  for (const e of employees) {
    const planned = plannedWorkdays({
      snapshot: workdaysSnapshot,
      month,
      userRole: e.role,
      userId: e.user_id
    });
    const worked = workedByUser.get(e.user_id);
    patch(e.user_id, {
      planned_days: planned,
      // Tabel bo‘lmasa — me’yorni ishlangan deb hisoblaymiz (hisob to‘xtamasligi uchun)
      worked_days: worked ?? planned,
      absent_days: Math.max(0, planned - (worked ?? planned))
    });
  }

  return result;
}

/** Supervayzer jamoasi agentlari (jamoa hisobi uchun). */
export async function listTeamAgentIds(tenantId: number, supervisorIds: number[]): Promise<number[]> {
  if (supervisorIds.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { tenant_id: tenantId, supervisor_user_id: { in: supervisorIds }, role: "agent" },
    select: { id: true }
  });
  return rows.map((r) => r.id);
}
