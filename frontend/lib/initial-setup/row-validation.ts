import type { InitialSetupStep } from "@/lib/initial-setup/types";
import type { StepTableConfig } from "@/lib/initial-setup/ref-table-config";
import { getStepTableConfig, requiredColumnKeys } from "@/lib/initial-setup/ref-table-config";

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, "_")
    .replace(/ё/g, "е");
}

/** Ustun sarlavhasini ichki kalitga (config.key) */
const HEADER_TO_KEY: Record<string, string> = {
  название_организации: "name",
  наименование: "name",
  название: "name",
  телефон: "phone",
  адрес: "address",
  артикул_sku: "sku",
  артикул: "sku",
  тип_цены: "price_type",
  цена: "price"
};

export function resolveCellKey(headerOrKey: string, config?: StepTableConfig): string {
  const norm = normalizeHeader(headerOrKey);
  const fromConfig = config?.columns.find(
    (c) => c.key === norm || c.key === headerOrKey || normalizeHeader(c.header) === norm
  );
  if (fromConfig) return fromConfig.key;
  return HEADER_TO_KEY[norm] ?? norm;
}

export function getCellValue(cells: Record<string, string>, key: string, config?: StepTableConfig): string {
  const resolved = resolveCellKey(key, config);
  const direct = cells[resolved] ?? cells[key];
  if (String(direct ?? "").trim()) return String(direct).trim();

  for (const col of config?.columns ?? []) {
    if (col.key !== resolved) continue;
    const h = normalizeHeader(col.header);
    const v = cells[h] ?? cells[col.header];
    if (String(v ?? "").trim()) return String(v).trim();
  }

  const alias = HEADER_TO_KEY[normalizeHeader(key)];
  if (alias && cells[alias]) return String(cells[alias]).trim();

  return "";
}

export function validateRowCells(
  cells: Record<string, string>,
  step?: InitialSetupStep,
  config?: StepTableConfig,
  legacyRequired?: string[]
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cfg = config ?? (step ? getStepTableConfig(step.id) : undefined);

  if (cfg?.columns.length) {
    for (const col of cfg.columns) {
      if (!col.required) continue;
      const val = getCellValue(cells, col.key, cfg);
      if (!val) {
        errors.push(`«${col.header}» — не заполнено (обязательное поле)`);
      }
    }
    return { errors, warnings };
  }

  const req = legacyRequired ?? (step ? requiredColumnKeys(step, cfg) : []);
  for (const col of req) {
    const val = getCellValue(cells, col, cfg);
    if (!val) errors.push(`«${col}» — не заполнено`);
  }
  return { errors, warnings };
}

/** Qatorlarni config kalitlariga birlashtiradi */
export function normalizeRowCells(
  cells: Record<string, string>,
  config?: StepTableConfig
): Record<string, string> {
  if (!config) return { ...cells };
  const out: Record<string, string> = { ...cells };
  for (const col of config.columns) {
    const v = getCellValue(cells, col.key, config);
    if (v) out[col.key] = v;
  }
  if (cells._id) out._id = cells._id;
  return out;
}

export function reindexPreviewRows<T extends { rowIndex: number }>(rows: T[]): (T & { rowIndex: number })[] {
  return rows.map((r, i) => ({ ...r, rowIndex: i + 1 }));
}
