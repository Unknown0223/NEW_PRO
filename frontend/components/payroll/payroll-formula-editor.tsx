export type FormulaDraft = {
  id?: number;
  name: string;
  scope: "bonus" | "allowance" | "salary" | "common";
  text: string;
  role: string | null;
  kpi_group_id: number | null;
  year: number | null;
  month: number | null;
  target_item_id: number | null;
  priority: number;
  is_active: boolean;
};

export const FORMULA_SCOPES: Array<{ v: FormulaDraft["scope"]; label: string; hint: string }> = [
  { v: "bonus", label: "Бонус (KPI)", hint: "Считается по выбранному KPI для выбранной роли" },
  { v: "allowance", label: "Надбавка по роли", hint: "Автоматически для всех сотрудников роли" },
  { v: "salary", label: "Расчёт оклада", hint: "Заменяет стандартный расчёт оклада для роли" },
  { v: "common", label: "Общая", hint: "Можно назначать вручную" }
];
