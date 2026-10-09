export type FormulaDraft = {
  id?: number;
  name: string;
  scope: "bonus" | "allowance" | "salary" | "common";
  text: string;
  role: string | null;
  target_item_id: number | null;
  priority: number;
  is_active: boolean;
};

export const FORMULA_SCOPES: Array<{ v: FormulaDraft["scope"]; label: string; hint: string }> = [
  { v: "bonus", label: "Бонус (KPI)", hint: "Назначается сотрудникам в «Настройках бонусов и зарплат»" },
  { v: "allowance", label: "Надбавка по роли", hint: "Автоматически для всех сотрудников роли" },
  { v: "salary", label: "Расчёт оклада", hint: "Заменяет стандартный расчёт оклада для роли" },
  { v: "common", label: "Общая", hint: "Можно назначать вручную" }
];
