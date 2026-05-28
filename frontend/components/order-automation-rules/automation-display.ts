import type { AutomationRuleRow } from "@/components/order-automation-rules/order-automation-types";

export const AUTOMATION_BADGE_COLORS: Record<string, string> = {
  Да: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Нет: "bg-red-50 text-red-700 border-red-200",
  Все: "bg-gray-50 text-gray-700 border-gray-200",
  all: "bg-gray-50 text-gray-700 border-gray-200",
  yes: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no: "bg-red-50 text-red-700 border-red-200",
  UZS: "bg-green-50 text-green-700 border-green-200",
  "So'm": "bg-green-50 text-green-700 border-green-200",
  USD: "bg-blue-50 text-blue-700 border-blue-200",
  EUR: "bg-yellow-50 text-yellow-700 border-yellow-200",
  RUB: "bg-red-50 text-red-700 border-red-200",
  instant: "bg-emerald-50 text-emerald-700 border-emerald-200",
  exact_time: "bg-blue-50 text-blue-700 border-blue-200",
  business_days_n: "bg-teal-50 text-teal-700 border-teal-200",
  web: "bg-cyan-50 text-cyan-700 border-cyan-200",
  mobile: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  Мгновенно: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Точное время": "bg-blue-50 text-blue-700 border-blue-200",
  "Через N рабочих дней": "bg-teal-50 text-teal-700 border-teal-200",
  "Веб-сайт": "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Мобильное приложение": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
};

export function consignmentLabel(mode: string): string {
  if (mode === "yes") return "Да";
  if (mode === "no") return "Нет";
  return "Все";
}

export function executionTypeLabel(t: string | undefined): string {
  if (t === "instant") return "Мгновенно";
  if (t === "exact_time") return "Точное время";
  if (t === "business_days_n") return "Через N рабочих дней";
  return t ?? "—";
}

export function sourceChannelLabel(ch: string): string {
  if (ch === "web") return "Веб-сайт";
  if (ch === "mobile") return "Мобильное приложение";
  return ch;
}

export function formatAmount(n: number | null): string {
  if (n == null) return "";
  return new Intl.NumberFormat("ru-RU").format(n);
}

export function rowExecutionTime(row: AutomationRuleRow): string {
  if (row.execution_type === "business_days_n") {
    const parts = [row.n_value != null ? `N=${row.n_value}` : null, row.execution_time].filter(Boolean);
    return parts.length ? parts.join(", ") : "—";
  }
  if (row.execution_type === "exact_time") return row.execution_time ?? "—";
  if (row.execution_type === "instant") return "—";
  return row.execution_time ?? "—";
}

export const EXECUTION_TYPE_OPTIONS = [
  { value: "instant", label: "Мгновенно" },
  { value: "exact_time", label: "Точное время" },
  { value: "business_days_n", label: "Через N рабочих дней" }
] as const;

export const SOURCE_CHANNEL_OPTIONS = [
  { value: "web" as const, label: "Веб-сайт" },
  { value: "mobile" as const, label: "Мобильное приложение" }
];
