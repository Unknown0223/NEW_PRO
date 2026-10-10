/**
 * ЗАРПЛАТА — rol katalogi.
 *
 * Har bir rol uchun «standart» hisob turi va UI matnlari. Formula yaratishda
 * shu ro‘yxat tanlov (dropdown) sifatida ishlatiladi; hisob engine esa
 * `PayrollFormula.roles` bo‘yicha moslikni tekshiradi.
 */
import type { PayrollFormulaKind } from "./payroll.types";

export type PayrollRoleDef = {
  role: string;
  labelRu: string;
  labelUz: string;
  /** Rol uchun tavsiya etilgan hisob turi. */
  defaultKind: PayrollFormulaKind;
  /** Rol uchun ma’noli bo‘lgan hisob turlari (UI filtri). */
  kinds: PayrollFormulaKind[];
  /** Rol uchun asosiy сетка metrikasi. */
  defaultMetric: string;
};

export const PAYROLL_ROLES: PayrollRoleDef[] = [
  {
    role: "agent",
    labelRu: "Агент (торговый)",
    labelUz: "Agent (savdo)",
    defaultKind: "kpi_bonus",
    kinds: ["kpi_bonus", "percent_sales", "fixed", "per_visit"],
    defaultMetric: "kpi_percent"
  },
  {
    role: "supervisor",
    labelRu: "Супервайзер",
    labelUz: "Supervayzer",
    defaultKind: "team_percent",
    kinds: ["team_percent", "kpi_bonus", "percent_sales", "fixed"],
    defaultMetric: "team_plan_sum"
  },
  {
    role: "expeditor",
    labelRu: "Экспедитор",
    labelUz: "Ekspeditor",
    defaultKind: "per_delivery",
    kinds: ["per_delivery", "per_collection", "fixed", "piece"],
    defaultMetric: "deliveries"
  },
  {
    role: "collector",
    labelRu: "Инкассатор",
    labelUz: "Inkassator",
    defaultKind: "per_collection",
    kinds: ["per_collection", "per_delivery", "fixed"],
    defaultMetric: "collection_sum"
  },
  {
    role: "auditor",
    labelRu: "Аудитор",
    labelUz: "Auditor",
    defaultKind: "per_visit",
    kinds: ["per_visit", "fixed", "piece"],
    defaultMetric: "audits_count"
  },
  {
    role: "merchandiser",
    labelRu: "Мерчандайзер",
    labelUz: "Merchandayzer",
    defaultKind: "per_visit",
    kinds: ["per_visit", "fixed"],
    defaultMetric: "visits"
  },
  {
    role: "skladchik",
    labelRu: "Складчик",
    labelUz: "Omborchi",
    defaultKind: "piece",
    kinds: ["piece", "fixed"],
    defaultMetric: "warehouse_ops"
  },
  {
    role: "gruzchik",
    labelRu: "Грузчик",
    labelUz: "Yukchi",
    defaultKind: "piece",
    kinds: ["piece", "fixed"],
    defaultMetric: "warehouse_ops"
  },
  {
    role: "storekeeper",
    labelRu: "Кладовщик",
    labelUz: "Ombor mudiri",
    defaultKind: "fixed",
    kinds: ["fixed", "piece"],
    defaultMetric: "warehouse_ops"
  },
  {
    role: "driver",
    labelRu: "Водитель",
    labelUz: "Haydovchi",
    defaultKind: "per_delivery",
    kinds: ["per_delivery", "fixed", "piece"],
    defaultMetric: "deliveries"
  },
  {
    role: "cashier",
    labelRu: "Кассир",
    labelUz: "Kassir",
    defaultKind: "fixed",
    kinds: ["fixed", "per_collection"],
    defaultMetric: "collection_sum"
  },
  {
    role: "operator",
    labelRu: "Оператор",
    labelUz: "Operator",
    defaultKind: "fixed",
    kinds: ["fixed", "kpi_bonus"],
    defaultMetric: "order_count"
  },
  {
    role: "manager",
    labelRu: "Менеджер",
    labelUz: "Menejer",
    defaultKind: "fixed",
    kinds: ["fixed", "team_percent", "kpi_bonus"],
    defaultMetric: "sales_sum"
  },
  {
    role: "regional_manager",
    labelRu: "Региональный менеджер",
    labelUz: "Mintaqa menejeri",
    defaultKind: "team_percent",
    kinds: ["team_percent", "fixed", "kpi_bonus"],
    defaultMetric: "team_sales_sum"
  },
  {
    role: "accountant",
    labelRu: "Бухгалтер",
    labelUz: "Buxgalter",
    defaultKind: "fixed",
    kinds: ["fixed", "kpi_bonus"],
    defaultMetric: "kpi_percent"
  },
  {
    role: "director",
    labelRu: "Директор",
    labelUz: "Direktor",
    defaultKind: "fixed",
    kinds: ["fixed", "team_percent"],
    defaultMetric: "sales_sum"
  },
  {
    role: "sales_director",
    labelRu: "Коммерческий директор",
    labelUz: "Tijorat direktori",
    defaultKind: "team_percent",
    kinds: ["team_percent", "fixed"],
    defaultMetric: "sales_sum"
  },
  {
    role: "commercial_director",
    labelRu: "Коммерческий директор (KPI)",
    labelUz: "Tijorat direktori (KPI)",
    defaultKind: "team_percent",
    kinds: ["team_percent", "fixed"],
    defaultMetric: "sales_sum"
  },
  {
    role: "warehouse_manager",
    labelRu: "Начальник склада",
    labelUz: "Ombor boshlig‘i",
    defaultKind: "fixed",
    kinds: ["fixed", "piece", "kpi_bonus"],
    defaultMetric: "warehouse_ops"
  },
  {
    role: "logist",
    labelRu: "Логист",
    labelUz: "Logist",
    defaultKind: "fixed",
    kinds: ["fixed", "per_delivery"],
    defaultMetric: "deliveries"
  },
  {
    role: "dispatcher",
    labelRu: "Диспетчер",
    labelUz: "Dispecher",
    defaultKind: "fixed",
    kinds: ["fixed", "per_delivery"],
    defaultMetric: "deliveries"
  }
];

export const PAYROLL_ROLE_BY_KEY: Record<string, PayrollRoleDef> = Object.fromEntries(
  PAYROLL_ROLES.map((r) => [r.role, r])
);

export const PAYROLL_ROLE_KEYS = PAYROLL_ROLES.map((r) => r.role);

export function payrollRoleLabel(role: string | null | undefined, lang: "ru" | "uz" = "ru"): string {
  const key = (role ?? "").trim();
  const def = PAYROLL_ROLE_BY_KEY[key];
  if (!def) return key || "—";
  return lang === "uz" ? def.labelUz : def.labelRu;
}

/** Rol uchun tavsiya etilgan hisob turi (noma’lum rol → `fixed`). */
export function payrollDefaultKindForRole(role: string | null | undefined): PayrollFormulaKind {
  return PAYROLL_ROLE_BY_KEY[(role ?? "").trim()]?.defaultKind ?? "fixed";
}

/** Rol uchun ruxsat etilgan hisob turlari (UI tanlovi). */
export function payrollKindsForRole(role: string | null | undefined): PayrollFormulaKind[] {
  return PAYROLL_ROLE_BY_KEY[(role ?? "").trim()]?.kinds ?? ["fixed"];
}
