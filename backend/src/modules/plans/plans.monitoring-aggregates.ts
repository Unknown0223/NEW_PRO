import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { buildSalesTerritoryAliasClause } from "../dashboard/sales-monitoring.scope";
import type { SalesMonitoringFilters } from "../dashboard/sales-monitoring.types";
import type { SupervisorDashboardFilters } from "../dashboard/dashboard.supervisor.scope";
import { orderScopeSql } from "../dashboard/dashboard.supervisor.scope";
import { decToString } from "../dashboard/dashboard.helpers";

/** Rasmiy KPI — faqat tasdiqlangan rejalar (dashboard / hisobot). */
export const OFFICIAL_KPI_PLAN_STATUSES = ["approved"] as const;

/** Agent mobil — tasdiqlash jarayonidagi reja ham ko‘rinsin. */
export const WORKING_KPI_PLAN_STATUSES = ["approved", "pending_approval"] as const;

export type PlanUserScopeInput = {
  tenantId: number;
  agent_ids: number[];
  supervisor_ids: number[];
  branch_codes: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  territory_terms: string[];
};

export type MonitoringPlanAggregates = {
  total: Prisma.Decimal;
  byBranch: Map<string, Prisma.Decimal>;
  bySupervisor: Map<number | null, Prisma.Decimal>;
  byAgent: Map<number, Prisma.Decimal>;
  hasApprovedPlans: boolean;
};

function planUserScopeSql(scope: PlanUserScopeInput, userAlias = "u"): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`${Prisma.raw(userAlias)}.tenant_id = ${scope.tenantId}`,
    Prisma.sql`${Prisma.raw(userAlias)}.is_active = true`
  ];
  if (scope.agent_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(userAlias)}.id IN (${Prisma.join(scope.agent_ids)})`);
  }
  if (scope.supervisor_ids.length > 0) {
    parts.push(
      Prisma.sql`${Prisma.raw(userAlias)}.supervisor_user_id IN (${Prisma.join(scope.supervisor_ids)})`
    );
  }
  if (scope.branch_codes.length > 0) {
    parts.push(
      Prisma.sql`COALESCE(TRIM(${Prisma.raw(userAlias)}.branch), '') IN (${Prisma.join(
        scope.branch_codes.map((c) => Prisma.sql`${c}`)
      )})`
    );
  }
  const territoryClauses: Prisma.Sql[] = [];
  if (scope.territory_1_list.length > 0) {
    territoryClauses.push(
      Prisma.sql`btrim(COALESCE(c.zone, '')) IN (${Prisma.join(
        scope.territory_1_list.map((p) => Prisma.sql`${p}`)
      )})`
    );
  }
  if (scope.territory_2_list.length > 0) {
    territoryClauses.push(
      Prisma.sql`btrim(COALESCE(c.region, '')) IN (${Prisma.join(
        scope.territory_2_list.map((p) => Prisma.sql`${p}`)
      )})`
    );
  }
  if (scope.territory_3_list.length > 0) {
    territoryClauses.push(
      Prisma.sql`btrim(COALESCE(c.city, '')) IN (${Prisma.join(
        scope.territory_3_list.map((p) => Prisma.sql`${p}`)
      )})`
    );
  }
  const territoryAlias = buildSalesTerritoryAliasClause("c", scope.territory_terms);
  const hasTerritory =
    scope.territory_1_list.length > 0 ||
    scope.territory_2_list.length > 0 ||
    scope.territory_3_list.length > 0 ||
    scope.territory_terms.length > 0;
  if (hasTerritory) {
    const innerParts: Prisma.Sql[] = [...territoryClauses];
    if (scope.territory_terms.length > 0) {
      innerParts.push(territoryAlias);
    }
    const clientTerritory =
      innerParts.length > 0 ? Prisma.join(innerParts, " AND ") : Prisma.sql`TRUE`;
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM client_agent_assignments caa
      JOIN clients c ON c.id = caa.client_id
      WHERE caa.agent_id = ${Prisma.raw(userAlias)}.id
        AND c.tenant_id = ${scope.tenantId}
        AND ${clientTerritory}
    )`);
  }
  return Prisma.join(parts, " AND ");
}

function planScopeFromMonitoringFilters(
  tenantId: number,
  filters: SalesMonitoringFilters,
  territoryTerms: string[]
): PlanUserScopeInput {
  return {
    tenantId,
    agent_ids: filters.agent_ids,
    supervisor_ids: filters.supervisor_ids,
    branch_codes: filters.branch_codes,
    territory_1_list: filters.territory_1_list,
    territory_2_list: filters.territory_2_list,
    territory_3_list: filters.territory_3_list,
    territory_terms: territoryTerms
  };
}

export function planScopeFromSupervisorFilters(
  tenantId: number,
  filters: SupervisorDashboardFilters
): PlanUserScopeInput {
  return {
    tenantId,
    agent_ids: filters.agent_ids,
    supervisor_ids: filters.supervisor_ids,
    branch_codes: [],
    territory_1_list: filters.territory_1_list,
    territory_2_list: filters.territory_2_list,
    territory_3_list: filters.territory_3_list,
    territory_terms: []
  };
}

function planStatusSql(statuses: readonly string[]): Prisma.Sql {
  return Prisma.sql`p.status IN (${Prisma.join(statuses.map((s) => Prisma.sql`${s}`))})`;
}

export async function loadMonitoringPlanAggregates(
  tenantId: number,
  month: number,
  year: number,
  userScope: PlanUserScopeInput,
  statuses: readonly string[] = OFFICIAL_KPI_PLAN_STATUSES
): Promise<MonitoringPlanAggregates> {
  const userFilter = planUserScopeSql(userScope);
  const statusFilter = planStatusSql(statuses);

  const [totalRows, branchRows, supervisorRows, agentRows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(t.cost), 0)::numeric(18,2) AS total
      FROM sales_kpi_plan_targets t
      INNER JOIN sales_kpi_plans p ON p.id = t.plan_id
      INNER JOIN users u ON u.id = t.user_id
      WHERE p.tenant_id = ${tenantId}
        AND p.month = ${month}
        AND p.year = ${year}
        AND ${statusFilter}
        AND ${userFilter}
    `,
    prisma.$queryRaw<Array<{ branch: string; plan_sales: Prisma.Decimal }>>`
      SELECT
        COALESCE(NULLIF(TRIM(u.branch), ''), '—') AS branch,
        COALESCE(SUM(t.cost), 0)::numeric(18,2) AS plan_sales
      FROM sales_kpi_plan_targets t
      INNER JOIN sales_kpi_plans p ON p.id = t.plan_id
      INNER JOIN users u ON u.id = t.user_id
      WHERE p.tenant_id = ${tenantId}
        AND p.month = ${month}
        AND p.year = ${year}
        AND ${statusFilter}
        AND ${userFilter}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ supervisor_id: number | null; plan_sales: Prisma.Decimal }>>`
      SELECT
        CASE
          WHEN u.role = 'supervisor' THEN u.id
          ELSE u.supervisor_user_id
        END AS supervisor_id,
        COALESCE(SUM(t.cost), 0)::numeric(18,2) AS plan_sales
      FROM sales_kpi_plan_targets t
      INNER JOIN sales_kpi_plans p ON p.id = t.plan_id
      INNER JOIN users u ON u.id = t.user_id
      WHERE p.tenant_id = ${tenantId}
        AND p.month = ${month}
        AND p.year = ${year}
        AND ${statusFilter}
        AND ${userFilter}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ agent_id: number; plan_sales: Prisma.Decimal }>>`
      SELECT
        u.id AS agent_id,
        COALESCE(SUM(t.cost), 0)::numeric(18,2) AS plan_sales
      FROM sales_kpi_plan_targets t
      INNER JOIN sales_kpi_plans p ON p.id = t.plan_id
      INNER JOIN users u ON u.id = t.user_id
      WHERE p.tenant_id = ${tenantId}
        AND p.month = ${month}
        AND p.year = ${year}
        AND ${statusFilter}
        AND ${userFilter}
        AND u.role = 'agent'
      GROUP BY 1
    `
  ]);

  const total = totalRows[0]?.total ?? new Prisma.Decimal(0);
  return {
    total,
    byBranch: new Map(branchRows.map((r) => [r.branch, r.plan_sales])),
    bySupervisor: new Map(supervisorRows.map((r) => [r.supervisor_id, r.plan_sales])),
    byAgent: new Map(agentRows.map((r) => [r.agent_id, r.plan_sales])),
    hasApprovedPlans: total.gt(0)
  };
}

export async function loadMonitoringPlanAggregatesForFilters(
  tenantId: number,
  filters: SalesMonitoringFilters,
  territoryTerms: string[]
): Promise<MonitoringPlanAggregates> {
  return loadMonitoringPlanAggregates(
    tenantId,
    filters.month,
    filters.year,
    planScopeFromMonitoringFilters(tenantId, filters, territoryTerms)
  );
}

export function monitoringPlanNote(hasApprovedPlans: boolean): string {
  return hasApprovedPlans
    ? "План из KPI «Установка планов» (статус «Одобрено»)."
    : "Нет одобренных KPI-планов на выбранный месяц. Задайте и утвердите в «Установка планов».";
}

export function executionPctFromPlanFact(plan: Prisma.Decimal | number, fact: number): number | null {
  const planNum = Number(plan instanceof Prisma.Decimal ? plan.toString() : plan);
  if (!Number.isFinite(planNum) || planNum <= 0 || !Number.isFinite(fact)) return null;
  return Math.min(100, Math.max(0, Math.round((fact / planNum) * 10000) / 100));
}

/** Supervayzer dashboard — oylik KPI reja vs MTD fakt. */
export async function loadSupervisorMonthlyKpiPlanBlock(
  tenantId: number,
  filters: SupervisorDashboardFilters
): Promise<{ planSum: string; factMtdSum: string; executionPct: number | null }> {
  const dayStart = new Date(`${filters.date}T00:00:00.000Z`);
  const month = dayStart.getUTCMonth() + 1;
  const year = dayStart.getUTCFullYear();
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  const mtdFilters: SupervisorDashboardFilters = { ...filters, order_statuses: undefined };
  const mtdScope = orderScopeSql(tenantId, monthStart, dayEnd, mtdFilters);

  const [planAgg, mtdRows] = await Promise.all([
    loadMonitoringPlanAggregates(tenantId, month, year, planScopeFromSupervisorFilters(tenantId, filters)),
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(oi.total), 0)::numeric(15,2) AS s
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${mtdScope}
    `
  ]);

  const factMtd = mtdRows[0]?.s ?? new Prisma.Decimal(0);
  return {
    planSum: decToString(planAgg.total),
    factMtdSum: decToString(factMtd),
    executionPct: executionPctFromPlanFact(planAgg.total, Number(factMtd.toString()))
  };
}
