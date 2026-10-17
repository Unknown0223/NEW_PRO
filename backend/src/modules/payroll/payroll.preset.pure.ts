/**
 * «РЕС» Excel oylik logikasi (AVGUST_2026):
 *   FIX / DOROJNIY = summa / ish kunlari normasi × ishlagan kun;
 *   KPI_n = ЕСЛИ(bajarish < 60.9%; 0; MIN(bajarish; 120%) × KPI_n summasi), bajarish = (Заказ − Возврат) / План;
 *   СВР — jamoa fakti / jamoa rejasi; Dop / Uchr bonus — qo'lda.
 */
export const RES_THRESHOLD = 60.9;
export const RES_CAP = 120;

export type ResItemSpec = { key: string; name: string; calc: "formula" | "manual"; sort: number; comment: string };

export const RES_ITEMS: ResItemSpec[] = [
  { key: "road", name: "Дорожные", calc: "formula", sort: 10, comment: "Пропорционально отработанным дням" },
  { key: "nollash", name: "Ноллаш", calc: "formula", sort: 20, comment: "Сумма справочно; начисляется только по формуле" },
  { key: "kpi1", name: "KPI 1", calc: "formula", sort: 30, comment: "KPI по 1-й группе товаров" },
  { key: "kpi2", name: "KPI 2", calc: "formula", sort: 31, comment: "KPI по 2-й группе товаров" },
  { key: "kpi3", name: "KPI 3", calc: "formula", sort: 32, comment: "KPI по 3-й группе товаров" },
  { key: "kpi4", name: "KPI 4", calc: "formula", sort: 33, comment: "KPI по 4-й группе товаров" },
  { key: "total", name: "Общий KPI", calc: "formula", sort: 40, comment: "KPI по общему плану" },
  { key: "dop", name: "Доп бонус", calc: "manual", sort: 50, comment: "Вводится вручную" },
  { key: "uchr", name: "Учр бонус", calc: "manual", sort: 51, comment: "Вводится вручную" }
];

export const RES_PRORATED = "[Оклад - Дорожные] / [Кол-во рабочих дней текущего месяца] * [Всего отработанных дней]";
export const resKpiText = (pctVar: string) =>
  `ЕСЛИ([${pctVar}] < ${RES_THRESHOLD}; 0; MIN([${pctVar}]; ${RES_CAP}) / 100 * [Оклад статьи])`;
export const RES_AGENT_KPI = resKpiText("KPI - Выполнение (%)");
export const RES_TEAM_KPI = resKpiText("Команда - Выполнение (%)");

export type ResFormulaSpec = {
  name: string;
  scope: "bonus" | "allowance";
  role: string | null;
  itemKey: string | null;
  text: string;
  priority: number;
};

export const RES_FORMULAS: ResFormulaSpec[] = [
  { name: "Дорожные — по дням (ТП)", scope: "allowance", role: "agent", itemKey: "road", text: RES_PRORATED, priority: 10 },
  { name: "Дорожные — по дням (СВР)", scope: "allowance", role: "supervisor", itemKey: "road", text: RES_PRORATED, priority: 10 },
  { name: "KPI по группе (ТП)", scope: "bonus", role: null, itemKey: null, text: RES_AGENT_KPI, priority: 50 },
  { name: "KPI по группе (СВР)", scope: "bonus", role: null, itemKey: null, text: RES_TEAM_KPI, priority: 50 },
  { name: "Общий KPI (ТП)", scope: "allowance", role: "agent", itemKey: "total", text: RES_AGENT_KPI, priority: 60 },
  { name: "Общий KPI (СВР)", scope: "allowance", role: "supervisor", itemKey: "total", text: RES_TEAM_KPI, priority: 60 }
];

/** «KPI по группе» — rol bo'yicha bonus formulasi nomi. */
export const RES_KPI_FORMULA_BY_ROLE: Record<string, string> = {
  agent: "KPI по группе (ТП)",
  supervisor: "KPI по группе (СВР)"
};

/** Rol bo'yicha standart summalar (Excel AVGUST_2026: ТП / СВР); KPI summalari hudud bo'yicha — xodimda. */
export const RES_ROLE_DEFAULTS: Record<string, { base: number; parts: Record<string, number> }> = {
  agent: { base: 2_000_000, parts: { road: 1_000_000, nollash: 600_000 } },
  supervisor: { base: 3_000_000, parts: { road: 2_000_000, nollash: 1_000_000 } }
};
export const RES_ROLE_COLUMNS = ["road", "nollash", "kpi1", "kpi2", "kpi3", "kpi4", "total", "dop", "uchr"];
