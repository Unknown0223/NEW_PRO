import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import type {
  SalesProAgentRow,
  SalesProBranchRow,
  SalesProCategoryRow,
  SalesProDayPoint,
  SalesProDirectionRow,
  SalesProUiModel
} from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";

const CATEGORY_COLORS = ["#12bd95", "#287cf4", "#9147ed", "#f7b62d", "#ff768f", "#4c91f7"];
const DIRECTION_COLORS = ["#12bd95", "#287cf4", "#9147ed", "#f7b62d", "#ff768f", "#4c91f7"];

function parseAmount(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const n = Number.parseFloat(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function emptyModel(): SalesProUiModel {
  return {
    plan: 0,
    fact: 0,
    completionPct: null,
    akb: 0,
    okb: 0,
    coveragePct: 0,
    days: [],
    categoryRows: [],
    branchRows: [],
    directionRows: [],
    agentRows: [],
    averageTicket: 0,
    periodLabel: "",
    planNote: "",
    ordersCount: 0,
    deliveredOrdersCount: 0
  };
}

function dayLabel(iso: string): string {
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${parts[2]}.${parts[1]}`;
}

/**
 * Daily plan is not in the API — per-day `plan` stays 0; month plan lives on summary.
 */
export function buildSalesProUiModel(
  input: Partial<MonitoringSnapshot> | null
): SalesProUiModel {
  if (!input) return emptyModel();

  const plan = parseAmount(input.plan_fact?.plan_sales);
  const fact = parseAmount(input.plan_fact?.fact_sales);
  const completionPct =
    input.plan_fact?.execution_pct == null || !Number.isFinite(input.plan_fact.execution_pct)
      ? null
      : input.plan_fact.execution_pct;

  const rawDays = input.daily_sales ?? [];
  // API da kunlik plan yo‘q — oy rejasini kunlarga teng taqsimlash (faqat chart/dinamika).
  const dayPlan = plan > 0 && rawDays.length > 0 ? plan / rawDays.length : 0;
  const days: SalesProDayPoint[] = rawDays.map((row) => {
    const dayFact = parseAmount(row.sales_sum);
    const completion = dayPlan > 0 ? (dayFact / dayPlan) * 100 : 0;
    return {
      label: dayLabel(row.day),
      plan: dayPlan,
      fact: dayFact,
      completion
    };
  });

  const categoryRows: SalesProCategoryRow[] = (input.category_sales ?? []).map((row, index) => ({
    name: row.category,
    amount: parseAmount(row.sales_sum),
    pct: Number.isFinite(row.share_pct) ? row.share_pct : 0,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]!
  }));

  const branchRows: SalesProBranchRow[] = (input.branch_performance ?? []).map((row, index) => {
    const rowPlan = parseAmount(row.plan_sales);
    const rowFact = parseAmount(row.fact_sales);
    const completion =
      row.execution_pct != null && Number.isFinite(row.execution_pct)
        ? row.execution_pct
        : rowPlan > 0
          ? (rowFact / rowPlan) * 100
          : null;
    return {
      id: `branch-${index}-${row.branch || "empty"}`,
      name: (row.branch || "").trim() || "Без филиала",
      akb: row.akb,
      okb: row.okb ?? 0,
      plan: rowPlan,
      fact: rowFact,
      completion
    };
  });

  const directionRows: SalesProDirectionRow[] = (input.trade_directions ?? []).map((row, index) => ({
    id: `dir-${index}-${row.direction}`,
    name: row.direction,
    plan: 0,
    fact: parseAmount(row.sales_sum),
    completion: null,
    color: DIRECTION_COLORS[index % DIRECTION_COLORS.length]!
  }));

  const agentRows: SalesProAgentRow[] = (input.supervisor_performance ?? []).map((row, index) => ({
    id: row.supervisor_id != null ? `sup-${row.supervisor_id}` : `sup-idx-${index}`,
    name: row.supervisor_name,
    akb: row.akb,
    plan: parseAmount(row.plan_sales),
    fact: parseAmount(row.fact_sales),
    completion: row.execution_pct,
    ordersCount: row.orders_count ?? 0
  }));

  const from = input.period?.from ?? "";
  const to = input.period?.to ?? "";
  const periodLabel = from && to ? `${from} — ${to}` : from || to;

  return {
    plan,
    fact,
    completionPct,
    akb: input.akb_okb?.akb ?? 0,
    okb: input.akb_okb?.okb ?? 0,
    coveragePct: input.akb_okb?.coverage_pct ?? 0,
    days,
    categoryRows,
    branchRows,
    directionRows,
    agentRows,
    averageTicket: parseAmount(input.summary?.aov),
    periodLabel,
    planNote: input.plan_fact?.plan_note ?? "",
    ordersCount: input.summary?.orders_count ?? 0,
    deliveredOrdersCount: input.summary?.delivered_orders_count ?? 0
  };
}
