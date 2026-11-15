import {
  MONTHS_UZ,
  employeeKey,
  type Formula,
  type KpiDataset,
  type ManualTarget,
  type ProposalSettings
} from "@salec/plans-proposal";
import type { ConfigMap } from "./selection";
import { fmt, fmtDecimal, formulaLabel } from "./format";

/** Demo sessiya egasi: barcha o‘zgartirishlar shu nom bilan yoziladi. */
export const AUDIT_ACTOR = "Planlovchi";

export type AuditAction =
  | "created"
  | "formula"
  | "reset"
  | "manual"
  | "excluded"
  | "restored"
  | "settings"
  | "delete"
  | "restore"
  | "rename"
  | "undo"
  | "import"
  | "context"
  | "visibility";

export type AuditEntry = {
  id: string;
  at: string;
  actor: string;
  action: AuditAction;
  contextKey: string;
  kpiGroupId: number | null;
  cellKey: string | null;
  employeeName: string | null;
  field: string;
  before: string | null;
  after: string | null;
  summary: string;
};

export type AuditChange = Pick<
  AuditEntry,
  "action" | "kpiGroupId" | "cellKey" | "employeeName" | "field" | "before" | "after" | "summary"
>;

export const ACTION_LABELS: Record<AuditAction, string> = {
  created: "Draft yaratildi",
  formula: "Formula o‘zgartirildi",
  reset: "Formula olib tashlandi",
  manual: "Qo‘lda qiymat",
  excluded: "Hisobdan chiqarildi",
  restored: "Hisobga qaytarildi",
  settings: "Qoida/sozlama",
  delete: "Qator o‘chirildi",
  restore: "Qator tiklandi",
  rename: "Nom o‘zgartirildi",
  undo: "Bekor qilindi",
  import: "JSON import",
  context: "Davr/yangilash",
  visibility: "Ustunlar"
};

export function describeFormula(formula: Formula | null): string {
  return formula ? formulaLabel(formula) : "Umumiy qoida";
}

export function describeManual(manual: ManualTarget | null): string {
  return manual ? `Qo‘lda ${fmt(manual.value)} so‘m · ${manual.reason}` : "Yo‘q";
}

export function describeSettings(settings: ProposalSettings): string {
  return `Yaxlitlash ${fmt(settings.roundingStep)} tiyin · ogohlantirish +${settings.growthWarningPercent}% · ${settings.sourceStatus === "official" ? "barcha maqomlar" : "faqat tasdiqlangan"}`;
}

/** Intl ning uz-UZ dateStyle chiqishi brauzerga qarab farq qiladi; barqaror format. */
export function auditTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = `${date.getDate()} ${MONTHS_UZ[date.getMonth()]} ${date.getFullYear()}`;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${day}, ${time}`;
}

export function makeAuditEntries(
  changes: AuditChange[],
  contextKey: string,
  meta: { at?: string; actor?: string; makeId?: () => string } = {}
): AuditEntry[] {
  const at = meta.at ?? new Date().toISOString();
  const actor = meta.actor ?? AUDIT_ACTOR;
  const makeId =
    meta.makeId ??
    (() =>
      globalThis.crypto?.randomUUID?.() ??
      `a-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return changes.map((change) => ({
    ...change,
    id: makeId(),
    at,
    actor,
    contextKey
  }));
}

function nameByKey(datasets: KpiDataset[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const dataset of datasets) {
    for (const employee of dataset.employees) {
      map.set(employeeKey(employee.employeeId, employee.workSlotId), employee.name);
    }
  }
  return map;
}

function mapKeys(values: Record<string, Formula> | undefined): Set<string> {
  return new Set(Object.keys(values ?? {}));
}

/**
 * Ikki konfiguratsiya orasidagi farqni har bir xodim×KPI katagi uchun alohida yozuvga aylantiradi.
 * `datasets` faqat xodim nomlarini topish uchun ishlatiladi.
 */
export function diffConfigs(
  before: ConfigMap,
  after: ConfigMap,
  datasets: KpiDataset[]
): AuditChange[] {
  const names = nameByKey(datasets);
  const changes: AuditChange[] = [];
  const kpiIds = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const kpiKey of [...kpiIds].sort((a, b) => Number(a) - Number(b))) {
    const kpiGroupId = Number(kpiKey);
    const old = before[kpiKey];
    const next = after[kpiKey];
    if (!old || !next) continue;
    const label = (key: string, field: string) =>
      `${names.get(key) ?? key} · KPI ${kpiGroupId} · ${field}`;

    const cellKeys = new Set([...mapKeys(old.cellFormulas), ...mapKeys(next.cellFormulas)]);
    for (const key of cellKeys) {
      const b = old.cellFormulas?.[key] ?? null;
      const a = next.cellFormulas?.[key] ?? null;
      if (JSON.stringify(b) === JSON.stringify(a)) continue;
      changes.push({
        action: a ? "formula" : "reset",
        kpiGroupId,
        cellKey: key,
        employeeName: names.get(key) ?? null,
        field: "Katak formulasi",
        before: describeFormula(b),
        after: describeFormula(a),
        summary: `${label(key, "katak formulasi")}: ${describeFormula(b)} → ${describeFormula(a)}`
      });
    }

    const manualKeys = new Set([...Object.keys(old.overrides), ...Object.keys(next.overrides)]);
    for (const key of manualKeys) {
      const b = old.overrides[key] ?? null;
      const a = next.overrides[key] ?? null;
      if (JSON.stringify(b) === JSON.stringify(a)) continue;
      changes.push({
        action: a ? "manual" : "reset",
        kpiGroupId,
        cellKey: key,
        employeeName: names.get(key) ?? null,
        field: "Qo‘lda reja",
        before: describeManual(b),
        after: describeManual(a),
        summary: `${label(key, "qo‘lda reja")}: ${describeManual(b)} → ${describeManual(a)}`
      });
    }

    const wasExcluded = new Set(old.excluded);
    const nowExcluded = new Set(next.excluded);
    for (const key of new Set([...wasExcluded, ...nowExcluded])) {
      const b = wasExcluded.has(key);
      const a = nowExcluded.has(key);
      if (b === a) continue;
      changes.push({
        action: a ? "excluded" : "restored",
        kpiGroupId,
        cellKey: key,
        employeeName: names.get(key) ?? null,
        field: "Hisobga kiritish",
        before: b ? "Chiqarilgan" : "Hisobda",
        after: a ? "Chiqarilgan" : "Hisobda",
        summary: `${label(key, "hisobga kiritish")}: ${b ? "Chiqarilgan" : "Hisobda"} → ${a ? "Chiqarilgan" : "Hisobda"}`
      });
    }

    if (JSON.stringify(old.defaultFormula) !== JSON.stringify(next.defaultFormula)) {
      changes.push({
        action: "settings",
        kpiGroupId,
        cellKey: null,
        employeeName: null,
        field: "Umumiy formula",
        before: describeFormula(old.defaultFormula),
        after: describeFormula(next.defaultFormula),
        summary: `KPI ${kpiGroupId} umumiy formulasi: ${describeFormula(old.defaultFormula)} → ${describeFormula(next.defaultFormula)}`
      });
    }
    if (JSON.stringify(old.rules) !== JSON.stringify(next.rules)) {
      changes.push({
        action: "settings",
        kpiGroupId,
        cellKey: null,
        employeeName: null,
        field: "Maxsus qoidalar",
        before: `${old.rules.length} ta qoida`,
        after: `${next.rules.length} ta qoida`,
        summary: `KPI ${kpiGroupId} maxsus qoidalari yangilandi (${next.rules.length} ta)`
      });
    }
    if (JSON.stringify(old.settings) !== JSON.stringify(next.settings)) {
      changes.push({
        action: "settings",
        kpiGroupId,
        cellKey: null,
        employeeName: null,
        field: "Sozlamalar",
        before: describeSettings(old.settings),
        after: describeSettings(next.settings),
        summary: `KPI ${kpiGroupId} sozlamalari yangilandi`
      });
    }
  }
  return changes;
}

export function cellAudit(
  entries: AuditEntry[],
  kpiGroupId: number,
  cellKey: string
): AuditEntry[] {
  return entries
    .filter((e) => e.kpiGroupId === kpiGroupId && e.cellKey === cellKey)
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

const csvCell = (value: string | null) => `"${(value ?? "").replace(/"/g, '""')}"`;

export function auditCsv(entries: AuditEntry[]): string {
  const header = [
    "Sana va vaqt",
    "Kim",
    "Xodim",
    "KPI",
    "Amal",
    "Maydon",
    "Avval",
    "Keyin",
    "Izoh"
  ];
  const lines = [...entries]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((e) =>
      [
        auditTime(e.at),
        e.actor,
        e.employeeName ?? "",
        e.kpiGroupId == null ? "" : `KPI ${e.kpiGroupId}`,
        ACTION_LABELS[e.action],
        e.field,
        e.before,
        e.after,
        e.summary
      ]
        .map((v) => csvCell(v))
        .join(";")
    );
  return `\uFEFF${header.map(csvCell).join(";")}\r\n${lines.join("\r\n")}\r\n`;
}

export function formatPercent(value: number | null): string {
  return value == null ? "—" : `${value > 0 ? "+" : ""}${fmtDecimal(value, 1)}%`;
}
