/**
 * ЗАРПЛАТА — umumiy tiplar.
 *
 * Bu fayl **sof** (pure): Prisma / Fastify import qilmaydi, shuning uchun
 * hisob mantiqi DB siz ham test qilinadi (`tests/payroll-*.pure.test.ts`).
 *
 * Bog‘lanish zanjiri:
 *   KpiGroup → PayrollFormula / PayrollGrid → (KpiGroupAgent orqali) User → PayrollEntry
 */

/** Hisob turi — rol bo‘yicha hisoblash usuli. */
export const PAYROLL_FORMULA_KINDS = [
  /** Faqat oklad (ish kuniga proporsional). */
  "fixed",
  /** Savdo summasidan foiz. */
  "percent_sales",
  /** Oklad + KPI сетка bo‘yicha bonus (agentlar uchun asosiy sxema). */
  "kpi_bonus",
  /** Jamoa savdosidan foiz (supervayzer). */
  "team_percent",
  /** Yetkazishlar soni × stawka + yig‘imdan foiz (ekspeditor). */
  "per_delivery",
  /** Yig‘ilgan summadan foiz + to‘lovlar soni × stawka (inkassator). */
  "per_collection",
  /** Tashriflar soni × stawka (merchandiser/auditor). */
  "per_visit",
  /** Bajarilgan operatsiya × stawka (omborchi/yukchi). */
  "piece"
] as const;

export type PayrollFormulaKind = (typeof PAYROLL_FORMULA_KINDS)[number];

export const PAYROLL_KIND_LABEL_RU: Record<PayrollFormulaKind, string> = {
  fixed: "Оклад",
  percent_sales: "% от продаж",
  kpi_bonus: "Оклад + KPI (сетка)",
  team_percent: "% от продаж команды",
  per_delivery: "За доставки",
  per_collection: "% от инкассации",
  per_visit: "За визиты",
  piece: "Сдельная (за операции)"
};

/** Сетка qatori natijasi qanday hisoblanishini belgilaydi. */
export const PAYROLL_GRID_MODES = ["coefficient", "amount", "percent"] as const;
export type PayrollGridMode = (typeof PAYROLL_GRID_MODES)[number];

export const PAYROLL_GRID_MODE_LABEL_RU: Record<PayrollGridMode, string> = {
  coefficient: "Коэффициент × база",
  amount: "Фикс. сумма",
  percent: "% от базы"
};

/** Hisobda ishlatiladigan ko‘rsatkichlar (метрики). */
export const PAYROLL_METRIC_KEYS = [
  "sales_sum",
  "sales_count",
  "sales_volume",
  "returns_sum",
  "new_clients",
  "active_clients",
  "visits",
  "collection_sum",
  "collection_count",
  "deliveries",
  "warehouse_ops",
  "audits_count",
  "plan_sum",
  "plan_count",
  "plan_volume",
  "worked_days",
  "planned_days",
  "absent_days",
  "team_sales_sum",
  "team_plan_sum",
  "team_headcount",
  "debt_sum"
] as const;

export type PayrollMetricKey = (typeof PAYROLL_METRIC_KEYS)[number];

/** Сетка o‘lchaydigan ko‘rsatkich: metrika yoki hisoblangan bajarilish foizi. */
export type PayrollGridMetric = PayrollMetricKey | "kpi_percent";

export type PayrollMetrics = Record<PayrollMetricKey, number>;

export const PAYROLL_METRIC_LABEL_RU: Record<PayrollMetricKey, string> = {
  sales_sum: "Продажи (сумма)",
  sales_count: "Заказы (кол-во)",
  sales_volume: "Объём продаж",
  returns_sum: "Возвраты (сумма)",
  new_clients: "Новые точки",
  active_clients: "Активные точки",
  visits: "Визиты",
  collection_sum: "Инкассация (сумма)",
  collection_count: "Инкассация (кол-во)",
  deliveries: "Доставки",
  warehouse_ops: "Складские операции",
  audits_count: "Аудиты",
  plan_sum: "План (сумма)",
  plan_count: "План (кол-во)",
  plan_volume: "План (объём)",
  worked_days: "Отработано дней",
  planned_days: "Норма дней",
  absent_days: "Прогулы",
  team_sales_sum: "Продажи команды",
  team_plan_sum: "План команды",
  team_headcount: "Численность команды",
  debt_sum: "Просроченный долг"
};

/** Ustama / ushlanma komponenti (formula `components`). */
export type PayrollComponent = {
  code: string;
  label: string;
  kind: "allowance" | "deduction";
  /** fixed = qat’iy summa; percent_base = okladga nisbatan %; percent_gross = hisoblangan sumaga nisbatan %. */
  mode: "fixed" | "percent_base" | "percent_gross";
  value: number;
};

/** Shart (gate): bajarilmasa o‘zgaruvchan qism kesiladi. */
export type PayrollGateOp = "lt" | "lte" | "gt" | "gte" | "eq";
export type PayrollGateEffect = "zero_variable" | "reduce_percent";

export type PayrollGate = {
  metric: PayrollGridMetric;
  op: PayrollGateOp;
  value: number;
  effect: PayrollGateEffect;
  /** effect = reduce_percent bo‘lganda necha foizga kesiladi. */
  reduce_percent?: number;
  label?: string;
};

/** Formula parametrlari (JSON `config`). Barcha maydonlar ixtiyoriy. */
export type PayrollFormulaConfig = {
  /** Foiz (percent_sales / team_percent / per_delivery …). */
  percent?: number;
  /** Foiz qaysi metrikaga qo‘llanadi. */
  percent_metric?: PayrollMetricKey;
  /** Birlik stawka (per_delivery / per_visit / piece). */
  rate_per_unit?: number;
  /** Stawka qaysi metrikaga qo‘llanadi. */
  unit_metric?: PayrollMetricKey;
  /** Сетка qo‘llansa: koeffitsiyent/foiz qaysi bazaga hisoblanadi. */
  bonus_base_metric?: PayrollMetricKey;
  /** `true` = bonus bazasi oklad (default). */
  bonus_base_is_oklad?: boolean;
  /** Okladni ish kuniga proporsional qilish: base | all | none. */
  attendance_prorate?: "base" | "all" | "none";
  /** Har bir прогул kuni uchun ushlanma (%). */
  absence_penalty_percent?: number;
  /** Yakuniy summani yaxlitlash (1, 10, 100, 1000 …). */
  round_to?: number;
  min_net?: number;
  max_net?: number;
};

/** Сетка bosqichi (UI/API uchun). */
export type PayrollGridStep = {
  id?: number;
  /** `null` = doimiy (baza) qator; "2026-10" = oylik сетка. */
  month: string | null;
  from_value: number | null;
  to_value: number | null;
  coefficient: number;
  amount: number;
  sort_order?: number;
};

export type PayrollGridData = {
  id: number;
  name: string;
  code?: string | null;
  kpi_group_id: number | null;
  metric: PayrollGridMetric;
  mode: PayrollGridMode;
  steps: PayrollGridStep[];
};

/** Hisobga kiruvchi xodim. */
export type PayrollEmployee = {
  user_id: number;
  fio: string;
  role: string;
  /** Xodim bog‘langan KPI guruhlari (`KpiGroupAgent`). */
  kpi_group_ids: number[];
};

/** Formula (DB shakli, Decimal → number). */
export type PayrollFormulaData = {
  id: number;
  name: string;
  code?: string | null;
  kind: PayrollFormulaKind;
  roles: string[];
  kpi_group_id: number | null;
  base_amount: number;
  config: PayrollFormulaConfig;
  components: PayrollComponent[];
  gates: PayrollGate[];
  priority: number;
  is_default: boolean;
  is_active: boolean;
  /** Amal qilish oralig‘i (ISO sana yoki `YYYY-MM-DD`). */
  valid_from?: string | null;
  valid_to?: string | null;
  grid?: PayrollGridData | null;
};

/** Qo‘lda kiritilgan tuzatish (надбавка/вычет) — oylik, xodim bo‘yicha. */
export type PayrollAdjustment = {
  code: string;
  label: string;
  /** Musbat = ustama, manfiy = ushlanma. */
  amount: number;
};

export type PayrollBreakdownLine = {
  code: string;
  label: string;
  amount: number;
  note?: string;
};

export type PayrollEntryResult = {
  user_id: number;
  formula_id: number | null;
  formula_name: string | null;
  kind: PayrollFormulaKind;
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
  /** Hisobga ta’sir qilgan ogohlantirishlar (formula yo‘q, шart bajarilmadi …). */
  warnings: string[];
};

/** Bir oylik hisob natijasi. */
export type PayrollMonthResult = {
  month: string;
  rows: PayrollEntryResult[];
  totals: {
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
};
