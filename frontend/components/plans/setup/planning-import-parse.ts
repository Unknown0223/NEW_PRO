import type { PlanningEmployee, PlanningKpiGroup, PlanningPlan, PlanningTarget } from "./planning-api";

export const PLAN_IMPORT_METRICS = [
  { key: "cost", label: "Сумма" },
  { key: "count", label: "Количество" },
  { key: "volume", label: "Объем" },
  { key: "acb", label: "АКБ" },
  { key: "order_count", label: "Кол-во-заказов" }
] as const;

export type PlanImportMetricKey = (typeof PLAN_IMPORT_METRICS)[number]["key"];

export type PlanImportRowStatus = "ok" | "warning" | "error";

export type PlanImportPreviewRow = {
  id: string;
  smartCode: string;
  agentName: string;
  filial: string;
  svr: string;
  userId: number | null;
  /** kpiGroupId → metric → raw string */
  metrics: Record<number, Partial<Record<PlanImportMetricKey, string>>>;
  status: PlanImportRowStatus;
  message: string;
};

function cellText(cell: unknown): string {
  if (cell == null) return "";
  if (typeof cell === "number" && Number.isFinite(cell)) return String(cell);
  return String(cell).trim();
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, "_")
    .replace(/ё/g, "е");
}

function isIdentityHeader(h: string): "agent" | "smart" | "filial" | "svr" | null {
  const n = normalizeHeader(h);
  if (n === "agent" || n === "agent_name" || n.includes("агент") || n === "fio" || n === "фио") {
    return "agent";
  }
  if (
    n === "smart" ||
    n === "smart_kod" ||
    n === "smart_code" ||
    n.includes("smart") ||
    n === "kod" ||
    n === "код" ||
    n.includes("смарт")
  ) {
    return "smart";
  }
  if (n === "filial" || n.includes("филиал") || n === "branch") return "filial";
  if (n === "svr" || n.includes("супервайзер") || n.includes("superv") || n === "свр") return "svr";
  return null;
}

function metricFromHeader(h: string): PlanImportMetricKey | null {
  const n = normalizeHeader(h);
  if (n.includes("сумм") || n === "cost" || n === "summa") return "cost";
  if (n.includes("колич") && !n.includes("заказ")) return "count";
  if (n === "count" || n === "qty") return "count";
  if (n.includes("объем") || n.includes("объём") || n === "volume") return "volume";
  if (n === "acb" || n.includes("акб")) return "acb";
  if (n.includes("заказ") || n === "order_count" || n.includes("кол-во-заказ")) return "order_count";
  return null;
}

function sanitizeNum(raw: string): string {
  return raw.replace(/\s/g, "").replace(",", ".");
}

export function buildAgentContextMap(employees: PlanningEmployee[]): Map<
  number,
  { name: string; code: string; filial: string; svr: string }
> {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const out = new Map<number, { name: string; code: string; filial: string; svr: string }>();

  for (const e of employees) {
    if (e.role !== "agent") continue;
    let svr = "";
    let filial = "";
    const parent = e.parent_id != null ? byId.get(e.parent_id) : null;
    if (parent) {
      if (parent.role === "supervisor") {
        svr = parent.name;
        const grand = parent.parent_id != null ? byId.get(parent.parent_id) : null;
        if (grand?.role === "branch") filial = grand.name;
      } else if (parent.role === "branch") {
        filial = parent.name;
      }
    }
    out.set(e.id, {
      name: e.name,
      code: (e.code ?? "").trim(),
      filial,
      svr
    });
  }
  return out;
}

export function buildSmartCodeIndex(
  employees: PlanningEmployee[]
): Map<string, PlanningEmployee> {
  const map = new Map<string, PlanningEmployee>();
  for (const e of employees) {
    if (e.role !== "agent") continue;
    const code = (e.code ?? "").trim();
    if (!code) continue;
    map.set(code.toLowerCase(), e);
    map.set(code.toUpperCase(), e);
  }
  return map;
}

function newRowId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyPlanImportRow(kpiGroups: PlanningKpiGroup[]): PlanImportPreviewRow {
  const metrics: PlanImportPreviewRow["metrics"] = {};
  for (const g of kpiGroups) {
    metrics[g.id] = {};
  }
  return {
    id: newRowId(),
    smartCode: "",
    agentName: "",
    filial: "",
    svr: "",
    userId: null,
    metrics,
    status: "error",
    message: "Укажите smart-код"
  };
}

export function revalidatePlanImportRow(
  row: PlanImportPreviewRow,
  smartIndex: Map<string, PlanningEmployee>,
  agentCtx: Map<number, { name: string; code: string; filial: string; svr: string }>
): PlanImportPreviewRow {
  const code = row.smartCode.trim();
  if (!code) {
    return { ...row, userId: null, status: "error", message: "Smart-код пуст" };
  }
  const emp = smartIndex.get(code) ?? smartIndex.get(code.toLowerCase()) ?? smartIndex.get(code.toUpperCase());
  if (!emp) {
    return {
      ...row,
      userId: null,
      status: "warning",
      message: "Код не найден в текущем списке — сервер проверит при сохранении"
    };
  }
  const ctx = agentCtx.get(emp.id);
  return {
    ...row,
    userId: emp.id,
    agentName: row.agentName.trim() || ctx?.name || emp.name,
    filial: row.filial.trim() || ctx?.filial || "",
    svr: row.svr.trim() || ctx?.svr || "",
    status: "ok",
    message: ""
  };
}

/** Shablon AOA: 2 qator header (KPI nomlari + tanlangan metrikalar) + agent qatorlari. */
export function buildPlanImportTemplateAoa(input: {
  kpiGroups: PlanningKpiGroup[];
  employees: PlanningEmployee[];
  plans: PlanningPlan[];
  targets: PlanningTarget[];
  /** KPI guruhi → ekranda tanlangan metrika labellari (Сумма, …). Bo‘sh bo‘lsa — faqat Сумма. */
  metricsByGroup?: Record<number, string[]>;
  directionName?: string;
  month?: number;
  year?: number;
}): { aoa: (string | number)[][]; merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] } {
  const { kpiGroups, employees, plans, targets, metricsByGroup, directionName, month, year } = input;
  const agentCtx = buildAgentContextMap(employees);
  const planByGroup = new Map(plans.map((p) => [p.kpi_group_id, p.id]));
  const targetByKey = new Map(targets.map((t) => [`${t.plan_id}:${t.user_id}`, t]));

  const metricsForGroup = (groupId: number) => {
    const labels = metricsByGroup?.[groupId]?.length
      ? metricsByGroup[groupId]!
      : ["Сумма"];
    const keys: PlanImportMetricKey[] = [];
    for (const label of labels) {
      const found = PLAN_IMPORT_METRICS.find((m) => m.label === label);
      if (found && !keys.includes(found.key)) keys.push(found.key);
    }
    return keys.length > 0 ? keys : (["cost"] as PlanImportMetricKey[]);
  };

  const identity = ["Агент", "Smart код", "Филиал", "SVR"];
  const metaBits = [
    directionName ? `Направление: ${directionName}` : "",
    month != null && year != null ? `Период: ${String(month).padStart(2, "0")}.${year}` : ""
  ].filter(Boolean);
  const metaRow: (string | number)[] = metaBits.length
    ? [metaBits.join(" · "), "", "", ""]
    : [];

  const header0: (string | number)[] = [...identity];
  const header1: (string | number)[] = ["", "", "", ""];
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
  const headerRowOffset = metaRow.length > 0 ? 1 : 0;

  let col = identity.length;
  for (const g of kpiGroups) {
    const keys = metricsForGroup(g.id);
    header0.push(g.name);
    for (let i = 1; i < keys.length; i++) header0.push("");
    for (const key of keys) {
      const label = PLAN_IMPORT_METRICS.find((m) => m.key === key)?.label ?? key;
      header1.push(label);
    }
    if (keys.length > 1) {
      merges.push({
        s: { r: headerRowOffset, c: col },
        e: { r: headerRowOffset, c: col + keys.length - 1 }
      });
    }
    col += keys.length;
  }

  // Meta qator KPI ustunlari bilan teng uzunlik
  if (metaRow.length > 0) {
    while (metaRow.length < header0.length) metaRow.push("");
  }

  const valueFor = (t: PlanningTarget | undefined, key: PlanImportMetricKey): string | number => {
    if (!t) return "";
    if (key === "cost") return Number(t.cost) || "";
    if (key === "count") return Number(t.count) || "";
    if (key === "volume") return Number(t.volume) || "";
    if (key === "acb") return Number(t.acb) || "";
    if (key === "order_count") return t.order_count || "";
    return "";
  };

  const agents = employees.filter((e) => e.role === "agent").sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const rows: (string | number)[][] = [];
  for (const a of agents) {
    const ctx = agentCtx.get(a.id);
    const line: (string | number)[] = [
      ctx?.name ?? a.name,
      (a.code ?? "").trim(),
      ctx?.filial ?? "",
      ctx?.svr ?? ""
    ];
    for (const g of kpiGroups) {
      const planId = planByGroup.get(g.id);
      const t = planId != null ? targetByKey.get(`${planId}:${a.id}`) : undefined;
      for (const key of metricsForGroup(g.id)) {
        line.push(valueFor(t, key));
      }
    }
    rows.push(line);
  }

  const aoa: (string | number)[][] = metaRow.length > 0
    ? [metaRow, header0, header1, ...rows]
    : [header0, header1, ...rows];

  return { aoa, merges };
}

type ColMap =
  | { kind: "identity"; field: "agent" | "smart" | "filial" | "svr" }
  | { kind: "metric"; kpiGroupId: number; metric: PlanImportMetricKey };

/**
 * Excel matrix → preview rows. KPI header qatori + metrikalar (yoki bitta header).
 * Meta-qator («Направление: …») avtomatik o‘tkazib yuboriladi.
 */
export function parsePlanImportMatrix(
  matrix: unknown[][],
  kpiGroups: PlanningKpiGroup[],
  employees: PlanningEmployee[]
): {
  rows: PlanImportPreviewRow[];
  metricsByGroup: Record<number, PlanImportMetricKey[]>;
} {
  const emptyMetrics = (): Record<number, PlanImportMetricKey[]> => {
    const m: Record<number, PlanImportMetricKey[]> = {};
    for (const g of kpiGroups) m[g.id] = ["cost"];
    return m;
  };

  if (matrix.length === 0) {
    return {
      rows: [
        {
          ...emptyPlanImportRow(kpiGroups),
          message: "Файл пуст",
          status: "error"
        }
      ],
      metricsByGroup: emptyMetrics()
    };
  }

  const smartIndex = buildSmartCodeIndex(employees);
  const agentCtx = buildAgentContextMap(employees);
  const kpiByName = new Map(kpiGroups.map((g) => [g.name.trim().toLocaleLowerCase("ru"), g.id]));

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const row = matrix[i] ?? [];
    for (const cell of row) {
      if (isIdentityHeader(cellText(cell)) === "smart") {
        headerRowIdx = i;
        break;
      }
    }
  }

  const row0 = matrix[headerRowIdx] ?? [];
  const row1 = matrix[headerRowIdx + 1] ?? [];
  const hasDualHeader = row1.some((c) => metricFromHeader(cellText(c)) != null);

  const colMaps: (ColMap | null)[] = [];
  let currentKpiId: number | null = null;
  const metricsByGroup: Record<number, PlanImportMetricKey[]> = {};

  const pushMetric = (kpiId: number, metric: PlanImportMetricKey) => {
    const list = metricsByGroup[kpiId] ?? (metricsByGroup[kpiId] = []);
    if (!list.includes(metric)) list.push(metric);
  };

  const maxCols = Math.max(row0.length, row1.length);
  for (let c = 0; c < maxCols; c++) {
    const h0 = cellText(row0[c]);
    const h1 = hasDualHeader ? cellText(row1[c]) : "";
    const id0 = isIdentityHeader(h0);
    if (id0) {
      colMaps[c] = { kind: "identity", field: id0 };
      continue;
    }

    if (hasDualHeader) {
      if (h0) {
        const kid = kpiByName.get(h0.toLocaleLowerCase("ru"));
        if (kid != null) currentKpiId = kid;
      }
      const metric = metricFromHeader(h1 || h0);
      if (metric && currentKpiId != null) {
        colMaps[c] = { kind: "metric", kpiGroupId: currentKpiId, metric };
        pushMetric(currentKpiId, metric);
      } else {
        colMaps[c] = null;
      }
      continue;
    }

    const parts = h0.split(/[|/—–\-]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const kid = kpiByName.get(parts[0]!.toLocaleLowerCase("ru"));
      const metric = metricFromHeader(parts.slice(1).join(" "));
      if (kid != null && metric) {
        colMaps[c] = { kind: "metric", kpiGroupId: kid, metric };
        pushMetric(kid, metric);
        continue;
      }
    }
    colMaps[c] = null;
  }

  for (const g of kpiGroups) {
    if (!metricsByGroup[g.id]?.length) metricsByGroup[g.id] = ["cost"];
  }

  const dataStart = headerRowIdx + (hasDualHeader ? 2 : 1);
  const out: PlanImportPreviewRow[] = [];

  for (let r = dataStart; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    if (!line.some((c) => cellText(c))) continue;

    const base = emptyPlanImportRow(kpiGroups);
    for (let c = 0; c < colMaps.length; c++) {
      const map = colMaps[c];
      if (!map) continue;
      const val = cellText(line[c]);
      if (map.kind === "identity") {
        if (map.field === "agent") base.agentName = val;
        if (map.field === "smart") base.smartCode = val;
        if (map.field === "filial") base.filial = val;
        if (map.field === "svr") base.svr = val;
      } else {
        const bucket = base.metrics[map.kpiGroupId] ?? (base.metrics[map.kpiGroupId] = {});
        if (val !== "") bucket[map.metric] = sanitizeNum(val);
      }
    }

    if (!base.smartCode && !base.agentName) continue;
    out.push(revalidatePlanImportRow(base, smartIndex, agentCtx));
  }

  if (out.length === 0) {
    return {
      rows: [
        {
          ...emptyPlanImportRow(kpiGroups),
          status: "error",
          message: "Нет строк данных. Нужны колонки: Агент, Smart код, Филиал, SVR и KPI."
        }
      ],
      metricsByGroup
    };
  }

  return { rows: out, metricsByGroup };
}

export function planImportRowsToPayload(
  rows: PlanImportPreviewRow[],
  kpiGroups: PlanningKpiGroup[]
): {
  smart_code: string;
  agent_name?: string;
  values: Array<{
    kpi_group_id: number;
    cost?: string;
    count?: string;
    volume?: string;
    acb?: string;
    order_count?: number;
  }>;
}[] {
  const out: ReturnType<typeof planImportRowsToPayload> = [];
  for (const row of rows) {
    const code = row.smartCode.trim();
    if (!code) continue;
    const values: (typeof out)[number]["values"] = [];
    for (const g of kpiGroups) {
      const m = row.metrics[g.id] ?? {};
      const hasAny = PLAN_IMPORT_METRICS.some((x) => (m[x.key] ?? "").trim() !== "");
      if (!hasAny) continue;
      const item: (typeof values)[number] = { kpi_group_id: g.id };
      if ((m.cost ?? "").trim()) item.cost = sanitizeNum(m.cost!);
      if ((m.count ?? "").trim()) item.count = sanitizeNum(m.count!);
      if ((m.volume ?? "").trim()) item.volume = sanitizeNum(m.volume!);
      if ((m.acb ?? "").trim()) item.acb = sanitizeNum(m.acb!);
      if ((m.order_count ?? "").trim()) {
        const n = Number.parseInt(sanitizeNum(m.order_count!), 10);
        if (Number.isFinite(n)) item.order_count = n;
      }
      values.push(item);
    }
    if (values.length === 0) continue;
    out.push({
      smart_code: code,
      agent_name: row.agentName.trim() || undefined,
      values
    });
  }
  return out;
}
