import {
  compactSupervisorProMoney,
  formatSupervisorProPct,
  parseSupervisorProAmount,
  supervisorProColor,
  supervisorProDateLabel
} from "@/components/dashboard/supervisor/pro/supervisor-pro-format";
import type {
  SupervisorProAgentVisitRow,
  SupervisorProCatalogRow,
  SupervisorProCatalogTab,
  SupervisorProPaymentRow,
  SupervisorProStatCard,
  SupervisorProUiModel
} from "@/components/dashboard/supervisor/pro/supervisor-pro-types";

export type SupervisorProSnapshotInput = {
  filters?: { date?: string };
  kpi?: {
    total_sales_sum?: string;
    cash_sales_sum?: string;
    sales_by_payment_method?: Array<{ method: string; sum: string }>;
    monthly_kpi_plan_sum?: string;
    monthly_kpi_fact_mtd_sum?: string;
    monthly_kpi_execution_pct?: number | null;
    planned_visits?: number;
    visited_planned?: number;
    visited_total?: number;
    successful_visits?: number;
    gps_visits?: number;
    photo_reports?: number;
    visit_pct?: number;
    success_pct?: number;
    gps_pct?: number;
    photo_pct?: number;
  };
  product_analytics?: {
    by_category?: Array<{
      dimension: string;
      share_pct: number;
      revenue: string;
      quantity: string;
      akb: number;
    }>;
    by_group?: Array<{
      dimension: string;
      share_pct: number;
      revenue: string;
      quantity: string;
      akb: number;
    }>;
    by_brand?: Array<{
      dimension: string;
      share_pct: number;
      revenue: string;
      quantity: string;
      akb: number;
    }>;
  };
  visit_report?: {
    rows?: Array<{
      agent_id: number;
      agent_name: string;
      agent_code?: string | null;
      supervisor_name?: string | null;
      planned_visits: number;
      visited_total: number;
      visits_with_orders?: number;
      gps_visits: number;
      photo_reports: number;
      photo_outlets?: number;
      photo_count?: number;
      sales_sum: string;
    }>;
    totals?: {
      planned_visits?: number;
      visited_total?: number;
      photo_reports?: number;
    };
  };
  efficiency_report?: {
    by_agents?: Array<{
      id: number;
      name: string;
      agent_code?: string | null;
      planned_visits: number;
      visited_total: number;
      visit_pct: number;
      photo_reports: number;
      photo_outlets?: number;
      photo_count?: number;
      total_sales_sum: string;
    }>;
  };
};

function emptyModel(date = ""): SupervisorProUiModel {
  return {
    dateLabel: supervisorProDateLabel(date || "2026-01-01"),
    monthProgressPct: 0,
    daysLeft: 0,
    planApproved: 0,
    planPending: null,
    mtdFact: 0,
    completionPct: null,
    forecastTrendUp: false,
    averageTicket: 0,
    neededPerDay: 0,
    paymentTotal: 0,
    methodRows: [],
    statCards: [],
    visitsToday: 0,
    photoPendingHint: 0,
    agentCount: 0,
    catalogByTab: { categories: [], groups: [], brands: [] },
    agentVisitRows: [],
    insights: []
  };
}

function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate();
}

function mapCatalog(
  rows: Array<{
    dimension: string;
    share_pct: number;
    revenue: string;
    quantity: string;
    akb: number;
  }>
): SupervisorProCatalogRow[] {
  return rows.map((row, index) => {
    const amount = parseSupervisorProAmount(row.revenue);
    const volume = parseSupervisorProAmount(row.quantity);
    return {
      id: `${row.dimension}-${index}`,
      name: row.dimension || "—",
      amount,
      volume,
      pct: Number.isFinite(row.share_pct) ? row.share_pct : 0,
      akb: row.akb ?? 0,
      avgCheck: volume > 0 ? amount / volume : 0,
      color: supervisorProColor(index)
    };
  });
}

export function buildSupervisorProUiModel(
  input: SupervisorProSnapshotInput | null | undefined
): SupervisorProUiModel {
  if (!input) return emptyModel();
  const date = input.filters?.date ?? "";
  const kpi = input.kpi ?? {};
  const ymd = date || "2026-01-01";
  const [ys, ms, ds] = ymd.split("-").map((x) => Number(x));
  const year = ys || 2026;
  const month = ms || 1;
  const day = Math.min(daysInMonth(year, month), Math.max(1, ds || 1));
  const dim = daysInMonth(year, month);
  const monthProgressPct = (day / dim) * 100;
  const daysLeft = Math.max(0, dim - day);

  const planApproved = parseSupervisorProAmount(kpi.monthly_kpi_plan_sum);
  const mtdFact = parseSupervisorProAmount(
    kpi.monthly_kpi_fact_mtd_sum ?? kpi.total_sales_sum
  );
  const completionPct =
    kpi.monthly_kpi_execution_pct == null || !Number.isFinite(kpi.monthly_kpi_execution_pct)
      ? planApproved > 0
        ? (mtdFact / planApproved) * 100
        : null
      : kpi.monthly_kpi_execution_pct;

  const methodRows: SupervisorProPaymentRow[] = (kpi.sales_by_payment_method ?? []).map(
    (row, index) => {
      const amount = parseSupervisorProAmount(row.sum);
      return {
        id: row.method || `m${index}`,
        name: row.method?.trim() || "Без метода",
        amount,
        sharePct: 0,
        color: supervisorProColor(index)
      };
    }
  );
  const paymentTotal = methodRows.reduce((s, r) => s + r.amount, 0);
  for (const row of methodRows) {
    row.sharePct = paymentTotal > 0 ? (row.amount / paymentTotal) * 100 : 0;
  }
  methodRows.sort((a, b) => b.amount - a.amount);

  const planned = kpi.planned_visits ?? 0;
  const visited = kpi.visited_total ?? kpi.visited_planned ?? 0;
  const successful = kpi.successful_visits ?? 0;
  const gps = kpi.gps_visits ?? 0;
  const photos = kpi.photo_reports ?? 0;

  const statCards: SupervisorProStatCard[] = [
    {
      id: "visits",
      name: "Визиты",
      plan: planned,
      fact: visited,
      pct: kpi.visit_pct ?? (planned > 0 ? (visited / planned) * 100 : 0)
    },
    {
      id: "success",
      name: "Успешные",
      plan: visited || planned,
      fact: successful,
      pct: kpi.success_pct ?? (visited > 0 ? (successful / visited) * 100 : 0)
    },
    {
      id: "gps",
      name: "GPS",
      plan: visited || planned,
      fact: gps,
      pct: kpi.gps_pct ?? (visited > 0 ? (gps / visited) * 100 : 0)
    },
    {
      id: "photos",
      name: "Фото",
      plan: visited || planned,
      fact: photos,
      pct: kpi.photo_pct ?? (visited > 0 ? (photos / visited) * 100 : 0)
    }
  ];

  const visitRowsSrc =
    input.visit_report?.rows?.length
      ? input.visit_report.rows
      : (input.efficiency_report?.by_agents ?? []).map((a) => ({
          agent_id: a.id,
          agent_name: a.name,
          agent_code: a.agent_code ?? null,
          supervisor_name: null as string | null,
          planned_visits: a.planned_visits,
          visited_total: a.visited_total,
          visits_with_orders: 0,
          gps_visits: 0,
          photo_reports: a.photo_reports,
          photo_outlets: a.photo_outlets,
          photo_count: a.photo_count,
          sales_sum: a.total_sales_sum
        }));

  const agentVisitRows: SupervisorProAgentVisitRow[] = visitRowsSrc.map((row) => {
    const plan = row.planned_visits ?? 0;
    const fact = row.visited_total ?? 0;
    const photos = row.photo_count ?? row.photo_reports ?? 0;
    const code = row.agent_code != null ? String(row.agent_code).trim() : "";
    return {
      id: String(row.agent_id),
      name: row.agent_name,
      code: code || null,
      supervisor: row.supervisor_name?.trim() || "—",
      plan,
      fact,
      success: row.visits_with_orders ?? 0,
      gps: row.gps_visits ?? 0,
      photos,
      photoOutlets: row.photo_outlets ?? row.photo_reports ?? photos,
      completion: plan > 0 ? (fact / plan) * 100 : 0,
      sales: parseSupervisorProAmount(row.sales_sum)
    };
  });

  const catalogByTab: Record<SupervisorProCatalogTab, SupervisorProCatalogRow[]> = {
    categories: mapCatalog(input.product_analytics?.by_category ?? []),
    groups: mapCatalog(input.product_analytics?.by_group ?? []),
    brands: mapCatalog(input.product_analytics?.by_brand ?? [])
  };

  const remaining = Math.max(0, planApproved - mtdFact);
  const neededPerDay = daysLeft > 0 ? remaining / daysLeft : remaining;
  const averageTicket = visited > 0 ? mtdFact / Math.max(1, visited) : 0;

  const base = {
    dateLabel: supervisorProDateLabel(ymd),
    monthProgressPct,
    daysLeft,
    planApproved,
    planPending: null as number | null,
    mtdFact,
    completionPct,
    forecastTrendUp: completionPct != null ? completionPct >= monthProgressPct : false,
    averageTicket,
    neededPerDay,
    paymentTotal: paymentTotal > 0 ? paymentTotal : parseSupervisorProAmount(kpi.total_sales_sum),
    methodRows,
    statCards,
    visitsToday: visited,
    photoPendingHint: photos,
    agentCount: agentVisitRows.length,
    catalogByTab,
    agentVisitRows
  };

  return {
    ...base,
    insights: []
  };
}

export function supervisorProCatalogTabLabel(tab: SupervisorProCatalogTab): string {
  if (tab === "categories") return "категории";
  if (tab === "groups") return "группы";
  return "бренды";
}

export { compactSupervisorProMoney };
