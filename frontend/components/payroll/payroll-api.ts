/**
 * ЗАРПЛАТА — API mijoz (frontend).
 *
 * Backend: `backend/src/modules/payroll/payroll.route.ts`
 */
import { api } from "@/lib/api";

export const PAYROLL_KIND_LABEL_RU: Record<string, string> = {
  fixed: "Оклад",
  percent_sales: "% от продаж",
  kpi_bonus: "Оклад + KPI (сетка)",
  team_percent: "% от продаж команды",
  per_delivery: "За доставки",
  per_collection: "% от инкассации",
  per_visit: "За визиты",
  piece: "Сдельная (за операции)"
};

export const PAYROLL_PERIOD_STATUS_LABEL_RU: Record<string, string> = {
  draft: "Черновик",
  calculated: "Рассчитано",
  approved: "Утверждено",
  paid: "Выплачено",
  locked: "Заблокировано"
};

export type PayrollComponentDto = {
  code: string;
  label: string;
  kind: "allowance" | "deduction";
  mode: "fixed" | "percent_base" | "percent_gross";
  value: number;
};

export type PayrollGateDto = {
  metric: string;
  op: "lt" | "lte" | "gt" | "gte" | "eq";
  value: number;
  effect: "zero_variable" | "reduce_percent";
  reduce_percent?: number;
  label?: string;
};

export type PayrollFormulaConfigDto = {
  percent?: number;
  percent_metric?: string;
  rate_per_unit?: number;
  unit_metric?: string;
  bonus_base_metric?: string;
  bonus_base_is_oklad?: boolean;
  attendance_prorate?: "base" | "all" | "none";
  absence_penalty_percent?: number;
  round_to?: number;
  min_net?: number;
  max_net?: number;
};

export type PayrollFormulaRow = {
  id: number;
  name: string;
  code: string | null;
  kind: string;
  roles: string[];
  kpi_group_id: number | null;
  base_amount: number;
  config: PayrollFormulaConfigDto;
  components: PayrollComponentDto[];
  gates: PayrollGateDto[];
  priority: number;
  is_default: boolean;
  is_active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  grid: PayrollGridRow | null;
  kpi_group_name: string | null;
  grid_id: number | null;
  grid_name: string | null;
  employee_count: number;
  sort_order: number;
  comment: string | null;
};

export type PayrollGridStep = {
  id?: number;
  month: string | null;
  from_value: number | null;
  to_value: number | null;
  coefficient: number;
  amount: number;
  sort_order?: number;
};

export type PayrollGridRow = {
  id: number;
  name: string;
  code: string | null;
  kpi_group_id: number | null;
  metric: string;
  mode: string;
  steps: PayrollGridStep[];
  kpi_group_name: string | null;
  is_active: boolean;
  sort_order: number;
  comment: string | null;
};

export type PayrollAssignmentRow = {
  user_id: number;
  fio: string;
  role: string;
  kpi_group_ids: number[];
  formula_id: number | null;
  formula_name: string | null;
  base_amount: number | null;
  comment: string | null;
};

export type PayrollPeriodRow = {
  id: number;
  month: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  entry_count: number;
  calculated_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
  comment: string | null;
};

export type PayrollBreakdownLine = { code: string; label: string; amount: number; note?: string };

export type PayrollEntryRow = {
  id: number;
  user_id: number;
  fio: string;
  role: string;
  formula_id: number | null;
  formula_name: string | null;
  kind: string;
  kpi_group_id: number | null;
  base_amount: number;
  variable_amount: number;
  allowance_amount: number;
  deduction_amount: number;
  adjustment_amount: number;
  gross_amount: number;
  net_amount: number;
  worked_days: number;
  planned_days: number;
  achievement_percent: number | null;
  breakdown: PayrollBreakdownLine[];
  status: string;
  comment: string | null;
  paid_amount: number;
  metrics: Record<string, number>;
};

export type PayrollCalcTotals = {
  employees: number;
  without_formula: number;
  base_amount: number;
  variable_amount: number;
  allowance_amount: number;
  deduction_amount: number;
  adjustment_amount: number;
  gross_amount: number;
  net_amount: number;
};

export type PayrollCalcPreview = { month: string; rows: unknown[]; totals: PayrollCalcTotals };

export type PayrollCalcResponse = {
  month: string;
  period: PayrollPeriodRow;
  preview?: PayrollCalcPreview;
  rows: PayrollEntryRow[];
  totals?: PayrollCalcTotals;
};

export type PayrollPaymentRow = {
  id: number;
  period_id: number | null;
  month: string | null;
  user_id: number;
  fio: string;
  role: string;
  role_label: string;
  amount: number;
  method: string;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  paid_at: string;
  comment: string | null;
  voided_at: string | null;
};

export type PayrollOptions = {
  roles: Array<{ role: string; label: string }>;
  kpi_groups: Array<{ id: number; name: string; agent_total: number }>;
  formulas: Array<{ id: number; name: string; kind: string; kpi_group_id: number | null }>;
  grids: Array<{ id: number; name: string; metric: string; mode: string }>;
  cash_desks: Array<{ id: number; name: string }>;
  months: string[];
};

export const payrollApi = {
  options: (slug: string) => api.get<{ data: PayrollOptions }>(`/api/${slug}/payroll/options`),
  formulas: (slug: string, params?: Record<string, string | undefined>) =>
    api.get<{ data: PayrollFormulaRow[] }>(`/api/${slug}/payroll/formulas`, { params }),
  createFormula: (slug: string, body: Record<string, unknown>) =>
    api.post<{ data: { id: number } }>(`/api/${slug}/payroll/formulas`, body),
  patchFormula: (slug: string, id: number, body: Record<string, unknown>) =>
    api.patch<{ data: { ok: true } }>(`/api/${slug}/payroll/formulas/${id}`, body),
  grids: (slug: string, params?: Record<string, string | undefined>) =>
    api.get<{ data: PayrollGridRow[] }>(`/api/${slug}/payroll/grids`, { params }),
  createGrid: (slug: string, body: Record<string, unknown>) =>
    api.post<{ data: { id: number } }>(`/api/${slug}/payroll/grids`, body),
  patchGrid: (slug: string, id: number, body: Record<string, unknown>) =>
    api.patch<{ data: { ok: true } }>(`/api/${slug}/payroll/grids/${id}`, body),
  assignments: (slug: string, params?: Record<string, string | undefined>) =>
    api.get<{ data: PayrollAssignmentRow[] }>(`/api/${slug}/payroll/assignments`, { params }),
  saveAssignments: (slug: string, items: Array<Record<string, unknown>>) =>
    api.put<{ data: { saved: number } }>(`/api/${slug}/payroll/assignments`, { items }),
  calc: (slug: string, params: Record<string, string | undefined>) =>
    api.get<PayrollCalcResponse>(`/api/${slug}/payroll/calc`, { params }),
  recalculate: (slug: string, params: Record<string, string | undefined>) =>
    api.post<PayrollCalcResponse>(`/api/${slug}/payroll/calc`, null, { params }),
  patchEntry: (slug: string, id: number, body: Record<string, unknown>) =>
    api.patch<{ data: { ok: true } }>(`/api/${slug}/payroll/entries/${id}`, body),
  setPeriodStatus: (slug: string, periodId: number, status: "approved" | "locked" | "draft") =>
    api.post<{ data: { ok: true; period: PayrollPeriodRow | null } }>(
      `/api/${slug}/payroll/periods/${periodId}/status`,
      { status }
    ),
  payments: (slug: string, params?: Record<string, string | undefined>) =>
    api.get<{ data: { rows: PayrollPaymentRow[]; total: number; paid: number } }>(
      `/api/${slug}/payroll/payments`,
      { params }
    ),
  createPayment: (slug: string, body: Record<string, unknown>) =>
    api.post<{ data: { id: number } }>(`/api/${slug}/payroll/payments`, body),
  voidPayment: (slug: string, id: number) =>
    api.post<{ data: { ok: true } }>(`/api/${slug}/payroll/payments/${id}/void`, {})
};

export const PAYROLL_QUERY_KEYS = {
  options: (slug: string) => ["payroll", "options", slug] as const,
  formulas: (slug: string) => ["payroll", "formulas", slug] as const,
  grids: (slug: string) => ["payroll", "grids", slug] as const,
  assignments: (slug: string) => ["payroll", "assignments", slug] as const,
  calc: (slug: string, month: string) => ["payroll", "calc", slug, month] as const,
  payments: (slug: string) => ["payroll", "payments", slug] as const
};
