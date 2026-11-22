import { Prisma } from "@prisma/client";
import { clampPct, decToString } from "./dashboard.helpers";
import type { FinanceProOpsBlock } from "./dashboard.finance.types";

export const INCOME_COLORS = ["#29c8a4", "#287cf4", "#9c54ec", "#ff768f", "#f7b62d", "#38c7ad"];
export const EXPENSE_COLORS = ["#287cf4", "#4c91f7", "#8448eb", "#ae5ce8", "#38c7ad", "#f7b62d", "#ff768f"];
export const ACCOUNT_COLORS = ["#287cf4", "#16bb91", "#356ee8", "#efaa16", "#9147ed", "#29c8a4"];

export function pctChange(current: Prisma.Decimal, previous: Prisma.Decimal): number | null {
  if (previous.isZero()) return current.isZero() ? 0 : null;
  return clampPct(current.sub(previous).div(previous).mul(100).toNumber());
}

export function sparkFromSeries(values: number[]): number[] {
  if (values.length === 0) return [1, 1, 1, 1, 1, 1, 1, 1];
  const max = Math.max(...values, 1);
  return values.slice(-17).map((v) => Math.max(1, Math.round((v / max) * 24)));
}

export function formatTxDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function statusLabel(workflow: string): string {
  if (workflow === "confirmed") return "Завершено";
  if (workflow === "pending_confirmation") return "В обработке";
  if (workflow === "rejected") return "Отклонено";
  return workflow || "—";
}

export function categoryRows(
  rows: Array<{ name: string; amount: Prisma.Decimal }>,
  colors: string[]
): FinanceProOpsBlock["income_categories"] {
  const total = rows.reduce((sum, r) => sum.add(r.amount), new Prisma.Decimal(0));
  return rows.map((r, i) => ({
    name: r.name,
    amount: decToString(r.amount),
    pct: total.gt(0) ? clampPct(r.amount.div(total).mul(100).toNumber()) : 0,
    color: colors[i % colors.length]!
  }));
}

export function mergeCashflowPeriods(
  payByPeriod: Array<{ period: Date; s: Prisma.Decimal }>,
  expByPeriod: Array<{ period: Date; s: Prisma.Decimal }>,
  clientExpByPeriod: Array<{ period: Date; s: Prisma.Decimal }>
): FinanceProOpsBlock["cashflow_by_period"] {
  const periodMap = new Map<string, { income: Prisma.Decimal; expense: Prisma.Decimal }>();
  const bump = (period: Date, field: "income" | "expense", amount: Prisma.Decimal) => {
    const key = period.toISOString().slice(0, 10);
    const cur = periodMap.get(key) ?? {
      income: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0)
    };
    cur[field] = cur[field].add(amount);
    periodMap.set(key, cur);
  };
  for (const r of payByPeriod) bump(r.period, "income", r.s);
  for (const r of expByPeriod) bump(r.period, "expense", r.s);
  for (const r of clientExpByPeriod) bump(r.period, "expense", r.s);
  return Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      income: decToString(v.income),
      expense: decToString(v.expense),
      profit: decToString(v.income.sub(v.expense))
    }));
}
