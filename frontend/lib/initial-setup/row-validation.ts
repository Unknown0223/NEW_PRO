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

/** Eski shablon «Единица измерения(код)» va yangi «…(название)» */
export function isUnitMeasureHeaderNorm(norm: string): boolean {
  const n = norm
    .replace(/[()]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/_$/, "");
  return n.includes("единица") && n.includes("измер");
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
  код_товара: "sku",
  тип_цены: "price_type",
  цена: "price",
  склад: "warehouse",
  категория: "category",
  category: "category_name",
  продукт: "name",
  количество_прихода: "receipt_qty",
  количество_в_блоке: "block_qty",
  уровень: "level",
  родитель: "parent",
  код: "code",
  способ_оплаты: "payment_method",
  способ_оплаты_название_код: "payment_method",
  способ_оплаты_код: "payment_method",
  to_lov_usuli: "payment_method",
  tolov_usuli: "payment_method",
  вид: "kind",
  вид_sale_purchase: "kind",
  вид_продажа_закупка: "kind",
  тип: "kind",
  kind: "kind",
  код_слота: "slot_code",
  название_слота: "label",
  код_филиала: "branch_code",
  тип_слота: "slot_type",
  активен_да_нет: "is_active",
  активен: "is_active",
  логин_агента: "assign_login",
  город: "name",
  код_города: "code",
  зона: "zone",
  gorod: "name",
  город: "name",
  shahar: "name",
  kod_gorod: "code",
  код_города: "code",
  gorod_kod: "code",
  название_региона: "region",
  регион: "region",
  oblast: "region",
  область: "region",
  viloyat: "region",
  zona: "zone",
  зона: "zone"
};

export function resolveCellKey(headerOrKey: string, config?: StepTableConfig): string {
  const norm = normalizeHeader(headerOrKey);
  const fromConfig = config?.columns.find(
    (c) => c.key === norm || c.key === headerOrKey || normalizeHeader(c.header) === norm
  );
  if (fromConfig) return fromConfig.key;
  if (isUnitMeasureHeaderNorm(norm) && config?.columns.some((c) => c.key === "unit_name")) {
    return "unit_name";
  }
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

  for (const [alias, target] of Object.entries(HEADER_TO_KEY)) {
    if (target !== resolved) continue;
    const v = cells[alias];
    if (String(v ?? "").trim()) return String(v).trim();
  }

  const alias = HEADER_TO_KEY[normalizeHeader(key)];
  if (alias && cells[alias]) return String(cells[alias]).trim();

  if (resolved === "category_name" || key === "category_name") {
    for (const k of ["category_name", "категория", "category"]) {
      const v = cells[k];
      if (String(v ?? "").trim()) return String(v).trim();
    }
  }

  if (resolved === "unit_name" || key === "unit_name") {
    for (const [k, v] of Object.entries(cells)) {
      if (isUnitMeasureHeaderNorm(normalizeHeader(k)) && String(v).trim()) {
        return String(v).trim();
      }
    }
  }

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

/** Preview ichida dublikatlarni belgilash (qizil ustunlar + xabar) */
export function annotateDuplicateErrors(
  rows: { cells: Record<string, string>; errors: string[]; errorFields?: string[] }[],
  config?: StepTableConfig
): void {
  const groups = config?.duplicateKeyGroups;
  if (!groups?.length) return;

  for (const row of rows) {
    row.errors = row.errors.filter((e) => !e.startsWith("Дубликат"));
    row.errorFields = undefined;
  }

  for (const keys of groups) {
    const seen = new Map<string, number>();
    rows.forEach((row, idx) => {
      const parts = keys.map((k) => getCellValue(row.cells, k, config).trim());
      if (parts.every((p) => !p)) return;
      if (parts.some((p) => !p)) return;
      const norm = parts.map((p) => p.toLowerCase().replace(/\s+/g, " ")).join("\u0000");
      const rowNo = idx + 1;
      const prev = seen.get(norm);
      if (prev != null) {
        const labels = keys
          .map((k) => config?.columns.find((c) => c.key === k)?.header ?? k)
          .join(" + ");
        row.errors.push(`Дубликат «${labels}» (строка ${prev})`);
        row.errorFields = [...new Set([...(row.errorFields ?? []), ...keys])];
      } else {
        seen.set(norm, rowNo);
      }
    });
  }

  for (const row of rows) {
    const fields = new Set(row.errorFields ?? []);
    for (const col of config?.columns ?? []) {
      if (row.errors.some((e) => e.includes(`«${col.header}»`) || e.includes(col.header))) {
        fields.add(col.key);
      }
    }
    row.errorFields = fields.size ? [...fields] : undefined;
  }
}

/** @deprecated use annotateDuplicateErrors */
export function annotateProductCatalogDuplicateErrors(
  rows: { cells: Record<string, string>; errors: string[]; errorFields?: string[] }[],
  config?: StepTableConfig
): void {
  annotateDuplicateErrors(rows, config);
}

/** Majburiy maydonlar + dublikat tekshiruvi */
export function revalidatePreviewRows<T extends { cells: Record<string, string>; rowIndex: number }>(
  rows: T[],
  config?: StepTableConfig
): (T & { errors: string[]; warnings: string[]; errorFields?: string[] })[] {
  const next = rows.map((r, i) => {
    const cells = normalizeRowCells(r.cells, config);
    const { errors, warnings } = validateRowCells(cells, undefined, config);
    return {
      ...r,
      rowIndex: i + 1,
      cells,
      errors,
      warnings,
      errorFields: undefined as string[] | undefined
    };
  });
  annotateDuplicateErrors(next, config);
  return next;
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
