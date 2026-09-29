import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { branchCashDeskIds } from "../tenant-settings/tenant-settings.types";
import { tenantMonthRangeUtc } from "../../lib/workday-calendar";
import { loadTenantTimezone } from "../tenant-settings/tenant-timezone";
import { branchMatches, loadTenantBranches } from "./payroll.advances.shared";

export type PayrollHealthIssue = {
  key: string;
  level: "error" | "warning" | "info";
  count: number;
  title: string;
  hint: string;
  href?: string;
};

/** Oylik raqamlariga ta'sir qiladigan, lekin tizimda avtomatik tuzatilmaydigan holatlar. */
export async function getPayrollHealth(tenantId: number, year: number, month: number) {
  const range = tenantMonthRangeUtc(year, month, await loadTenantTimezone(tenantId));
  const [calcErrors, dirty, pendingPlans, multiGroup, noVolume, unallocated, approved, links, branches, settings] = await Promise.all([
    prisma.payrollRecord.count({ where: { tenant_id: tenantId, year, month, calc_error: { not: null } } }),
    prisma.payrollRecord.count({ where: { tenant_id: tenantId, year, month, dirty_at: { not: null } } }),
    prisma.salesKpiPlan.count({ where: { tenant_id: tenantId, year, month, status: "pending_approval" } }),
    prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM (
        SELECT gp.product_id FROM kpi_group_products gp
        JOIN kpi_groups g ON g.id = gp.kpi_group_id
        WHERE g.tenant_id = ${tenantId} AND g.is_active = true
        GROUP BY gp.product_id HAVING COUNT(*) > 1
      ) x`),
    prisma.product.count({ where: { tenant_id: tenantId, is_active: true, OR: [{ volume_m3: null }, { volume_m3: 0 }] } }),
    prisma.$queryRaw<Array<{ n: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS n FROM sales_returns sr
      WHERE sr.tenant_id = ${tenantId} AND sr.status <> 'cancelled' AND sr.order_id IS NULL
        AND sr.created_at >= ${range.from} AND sr.created_at < ${range.to}
        AND NOT EXISTS (
          SELECT 1 FROM orders o
          WHERE o.tenant_id = sr.tenant_id AND o.client_id = sr.client_id AND o.order_type = 'order'
            AND o.status <> 'cancelled' AND o.agent_id IS NOT NULL AND o.created_at <= sr.created_at
        )`),
    prisma.payrollAdvance.findMany({
      where: { tenant_id: tenantId, status: "approved" },
      select: { branch_snapshot: true }
    }),
    prisma.cashDeskUserLink.findMany({
      where: { link_role: "cashier", cash_desk: { tenant_id: tenantId, is_active: true } },
      select: { cash_desk_id: true }
    }),
    loadTenantBranches(tenantId),
    prisma.payrollSettings.findUnique({ where: { tenant_id: tenantId } })
  ]);
  const cashierDesks = new Set(links.map((l) => l.cash_desk_id));
  const noCashier = approved.filter((a) => {
    const b = branches.find((x) => branchMatches(x, a.branch_snapshot));
    return !b || !branchCashDeskIds(b).some((d) => cashierDesks.has(d));
  }).length;

  const issues: PayrollHealthIssue[] = [
    {
      key: "calc_errors",
      level: "error",
      count: calcErrors,
      title: "Ошибки расчёта",
      hint: "Проверьте формулы: у сотрудников строка с ошибкой посчитана как 0.",
      href: "/users/salary/formulas"
    },
    {
      key: "advances_no_cashier",
      level: "error",
      count: noCashier,
      title: "Авансы без кассира",
      hint: "У филиала сотрудника нет кассы с кассиром — аванс не появится в очереди выдачи.",
      href: "/finance/cashier-queue"
    },
    {
      key: "unallocated_returns",
      level: "warning",
      count: Number(unallocated[0]?.n ?? 0),
      title: "Возвраты без агента",
      hint: "У клиента нет заказов с агентом — возврат не удалось отнести ни к одному агенту и он не уменьшил KPI."
    },
    {
      key: "pending_plans",
      level: "warning",
      count: pendingPlans,
      title: "Планы на утверждении",
      hint: "Планы в статусе «На утверждении» уже учитываются в KPI, но могут измениться.",
      href: "/plans"
    },
    {
      key: "multi_group_products",
      level: "warning",
      count: Number(multiGroup[0]?.n ?? 0),
      title: "Товар в нескольких KPI-группах",
      hint: "Продажа такого товара засчитывается в каждую группу."
    },
    {
      key: "no_volume_products",
      level: "info",
      count: noVolume,
      title: "Товары без объёма",
      hint: "KPI «Объем» по этим товарам равен 0."
    },
    {
      key: "dirty",
      level: "info",
      count: dirty,
      title: "Ожидают пересчёта",
      hint: "Данные изменились, пересчёт выполняется автоматически в течение нескольких минут."
    }
  ];
  return {
    year,
    month,
    enabled: Boolean(settings?.enabled),
    parallel_run: Boolean(settings?.parallel_run),
    issues: issues.filter((i) => i.count > 0),
    ok: !issues.some((i) => i.count > 0 && i.level === "error")
  };
}
