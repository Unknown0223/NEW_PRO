import { monthToDateYmd } from "../../lib/month-to-date";
import { intList, strList } from "./expeditor-returns.helpers";
import type {
  BalanceControlBalanceFilter,
  BalanceControlReportFilters,
  BalanceDebtFlag
} from "./balance-control-report.types";

const BALANCE_FILTERS = new Set<BalanceControlBalanceFilter>(["all", "debt", "credit", "zero"]);

export function parseBalanceFilter(raw?: string): BalanceControlBalanceFilter {
  const v = (raw ?? "all").trim() as BalanceControlBalanceFilter;
  return BALANCE_FILTERS.has(v) ? v : "all";
}

/** `client_balances.balance`: отрицательный — долг, положительный — переплата. */
export function resolveBalanceDebtFlag(balance: string | number): BalanceDebtFlag {
  const n = Number(balance);
  if (!Number.isFinite(n) || n === 0) return "zero";
  return n < 0 ? "debt" : "credit";
}

export function balanceDebtFlagLabel(flag: BalanceDebtFlag): string {
  if (flag === "debt") return "Долг";
  if (flag === "credit") return "Переплата";
  return "Ноль";
}

export function parseBalanceControlReportQuery(
  q: Record<string, string | undefined>
): BalanceControlReportFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    agent_ids: intList(q.agent_ids),
    client_categories: strList(q.client_categories),
    territory_1_list: strList(q.territory_1_list),
    territory_2_list: strList(q.territory_2_list),
    territory_3_list: strList(q.territory_3_list),
    balance_filter: parseBalanceFilter(q.balance_filter),
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}