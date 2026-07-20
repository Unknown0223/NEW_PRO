import * as XLSX from "xlsx";
import type { InitialSetupPreviewRow, InitialSetupPreviewState } from "@/lib/initial-setup/types";
import type { StepTableConfig } from "@/lib/initial-setup/ref-table-config";
import {
  getCellValue,
  normalizeRowCells,
  resolveCellKey,
  validateRowCells,
  annotateDuplicateErrors,
  revalidatePreviewRows
} from "@/lib/initial-setup/row-validation";
import {
  getCanonicalSampleRegistry,
  isUnchangedTemplateSampleRow,
  registryFromSamplesMetadata,
  TEMPLATE_SAMPLES_SHEET,
  type TemplateSampleRegistry
} from "@/lib/initial-setup/template-sample-matcher";

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, "_")
    .replace(/ё/g, "е");
}

export async function parseXlsxPreview(
  file: File,
  requiredColumns?: string[],
  maxRows = 200,
  config?: StepTableConfig,
  sampleRegistry?: TemplateSampleRegistry | null
): Promise<InitialSetupPreviewState> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  let registry = sampleRegistry;
  if (!registry) {
    const metaSheet = wb.Sheets[TEMPLATE_SAMPLES_SHEET];
    if (metaSheet) {
      const metaMatrix = XLSX.utils.sheet_to_json<unknown[]>(metaSheet, {
        header: 1,
        defval: ""
      }) as unknown[][];
      registry = registryFromSamplesMetadata(metaMatrix);
    }
  }
  if (!registry) registry = getCanonicalSampleRegistry();

  const stepId = config?.stepId;
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { columns: [], rows: [], fileName: file.name };
  }
  const sheet = wb.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  if (!matrix.length) {
    return { columns: [], rows: [], fileName: file.name };
  }

  const headerRow = matrix[0] ?? [];

  // product-prices: keng Excel (SKU | Naxt | Terminal…) → uzun preview (SKU | Тип цены | Цена)
  if (stepId === "product-prices") {
    const expanded = expandWidePriceMatrix(headerRow, matrix.slice(1), maxRows, registry);
    if (expanded) {
      annotateDuplicateErrors(expanded.rows, config);
      return { columns: expanded.columns, rows: expanded.rows, fileName: file.name };
    }
  }

  const columns = headerRow.map((h) => String(h ?? "").trim()).filter((h) => h.length > 0);
  const normKeys = columns.map((c) => normalizeHeader(c));

  const rows: InitialSetupPreviewRow[] = [];
  for (let i = 1; i < matrix.length && rows.length < maxRows; i++) {
    const line = matrix[i] ?? [];
    if (!line.some((c) => String(c ?? "").trim())) continue;
    if (isUnchangedTemplateSampleRow(stepId, columns, line, registry)) continue;
    const rawCells: Record<string, string> = {};
    for (let c = 0; c < headerRow.length; c++) {
      const orig = String(headerRow[c] ?? "").trim();
      if (!orig) continue;
      const nk = normalizeHeader(orig);
      const v = String(line[c] ?? "").trim();
      rawCells[nk] = v;
      rawCells[orig] = v;
    }
    const cells = normalizeRowCells(rawCells, config);
    const { errors, warnings } = validateRowCells(cells, undefined, config, requiredColumns);
    rows.push({ rowIndex: rows.length + 1, cells, errors, warnings });
  }

  // Agar keng format "uzun" deb noto‘g‘ri o‘qilgan bo‘lsa — qayta yoyish
  if (stepId === "product-prices") {
    const rescued = rescueWidePriceRows(rows, maxRows);
    if (rescued) {
      annotateDuplicateErrors(rescued.rows, config);
      return { columns: rescued.columns, rows: rescued.rows, fileName: file.name };
    }
  }

  if ((config?.duplicateKeyGroups?.length ?? 0) > 0) {
    annotateDuplicateErrors(rows, config);
  }

  return { columns, rows, fileName: file.name };
}

function cellAsText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function isSkuNorm(n: string): boolean {
  return n === "sku" || n === "kod" || n === "artikul" || n.includes("артикул") || n === "код_товара";
}

function isDedicatedPriceNorm(n: string): boolean {
  return n === "price" || n === "цена" || n === "narxi" || n === "summa" || n === "сумма";
}

function isDedicatedTypeNorm(n: string): boolean {
  return (
    n === "price_type" ||
    n === "тип_цены" ||
    n === "тип_цены_код" ||
    n === "tur" ||
    n.includes("narx_turi") ||
    n === "тип_цен"
  );
}

function isMetaNorm(n: string): boolean {
  return (
    isSkuNorm(n) ||
    n === "name" ||
    n === "название" ||
    n === "наименование" ||
    n === "nomi" ||
    n === "product" ||
    n === "продукт" ||
    n === "category" ||
    n === "категория" ||
    n === "comment" ||
    n === "комментарий"
  );
}

function expandWidePriceMatrix(
  headerRow: unknown[],
  dataLines: unknown[][],
  maxRows: number,
  registry: TemplateSampleRegistry | null | undefined
): { columns: string[]; rows: InitialSetupPreviewRow[] } | null {
  const cols = headerRow
    .map((h, idx) => ({ header: cellAsText(h), idx }))
    .filter((c) => c.header.length > 0);
  if (!cols.length) return null;

  const labeled = cols.map((c) => ({ ...c, norm: normalizeHeader(c.header) }));
  const skuCol = labeled.find((c) => isSkuNorm(c.norm));
  if (!skuCol) return null;

  // Uzun format: alohida «Цена» ustuni bor
  if (labeled.some((c) => isDedicatedPriceNorm(c.norm))) return null;

  const typeCols = labeled.filter(
    (c) => c.idx !== skuCol.idx && !isMetaNorm(c.norm) && !isDedicatedTypeNorm(c.norm)
  );
  if (!typeCols.length) return null;

  const headerLabels = cols.map((c) => c.header);
  const outCols = ["Артикул (SKU)", "Тип цены", "Цена"];
  const rows: InitialSetupPreviewRow[] = [];

  for (const line of dataLines) {
    if (rows.length >= maxRows) break;
    if (!line.some((c) => cellAsText(c))) continue;
    if (isUnchangedTemplateSampleRow("product-prices", headerLabels, line, registry)) continue;
    const sku = cellAsText(line[skuCol.idx]);
    if (!sku) continue;
    for (const tc of typeCols) {
      if (rows.length >= maxRows) break;
      const price = cellAsText(line[tc.idx]);
      if (!price) continue;
      const cells = {
        sku,
        price_type: tc.header,
        price,
        "Артикул (SKU)": sku,
        "Тип цены": tc.header,
        Цена: price
      };
      const { errors, warnings } = validateRowCells(cells, undefined, undefined, ["sku", "price"]);
      rows.push({ rowIndex: rows.length + 1, cells, errors, warnings });
    }
  }

  return rows.length ? { columns: outCols, rows } : null;
}

/** Normalize qilingan long jadvalda narxlar bo‘sh, lekin keng ustun qiymatlari saqlangan holat */
export function rescueWidePriceRows(
  rows: InitialSetupPreviewRow[],
  maxRows: number
): { columns: string[]; rows: InitialSetupPreviewRow[] } | null {
  if (!rows.length) return null;
  const skip = new Set([
    "sku",
    "price",
    "price_type",
    "артикул_(sku)",
    "артикул",
    "тип_цены",
    "цена",
    "_id"
  ]);
  const hasLongPrice = rows.some((r) => String(r.cells.price ?? "").trim());
  if (hasLongPrice) return null;

  const typeKeys = new Set<string>();
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.cells)) {
      const nk = normalizeHeader(k);
      if (skip.has(nk) || skip.has(k) || isMetaNorm(nk) || isDedicatedTypeNorm(nk)) continue;
      if (String(v ?? "").trim()) typeKeys.add(k);
    }
  }
  if (!typeKeys.size) return null;

  const outCols = ["Артикул (SKU)", "Тип цены", "Цена"];
  const out: InitialSetupPreviewRow[] = [];
  for (const r of rows) {
    const sku = String(r.cells.sku ?? r.cells["Артикул (SKU)"] ?? "").trim();
    if (!sku) continue;
    for (const key of typeKeys) {
      if (out.length >= maxRows) break;
      const price = String(r.cells[key] ?? "").trim();
      if (!price) continue;
      const cells = {
        sku,
        price_type: key,
        price,
        "Артикул (SKU)": sku,
        "Тип цены": key,
        Цена: price
      };
      const { errors, warnings } = validateRowCells(cells, undefined, undefined, ["sku", "price"]);
      out.push({ rowIndex: out.length + 1, cells, errors, warnings });
    }
  }
  return out.length ? { columns: outCols, rows: out } : null;
}

export function updatePreviewCell(
  state: InitialSetupPreviewState,
  rowIndex: number,
  column: string,
  value: string,
  config?: StepTableConfig
): InitialSetupPreviewState {
  const colKey = resolveCellKey(column, config);
  const patched = state.rows.map((r) => {
    if (r.rowIndex !== rowIndex) return r;
    const cells = normalizeRowCells({ ...r.cells, [colKey]: value, [column]: value }, config);
    return { ...r, cells };
  });
  const rows = revalidatePreviewRows(patched, config);
  return { ...state, rows };
}

export function previewHasBlockingErrors(state: InitialSetupPreviewState): boolean {
  return state.rows.some((r) => r.errors.length > 0);
}

/** Import qadamlari uchun server kutgan sarlavhalar + yuklangan qo‘shimcha ustunlar. */
function importHeaders(state: InitialSetupPreviewState, config?: StepTableConfig): string[] {
  if (!config || config.mode !== "import" || !config.columns.length) {
    return state.columns;
  }
  const canonical = config.columns.map((c) => c.header);
  const canonicalKeys = new Set(config.columns.map((c) => c.key));
  // Eski «Единица измерения(код)» ni yangi «…(название)» bilan bir xil deb hisobla —
  // aks holda ikkala ustun ham qayta yoziladi va backend «название» ni nom deb o‘qishi mumkin.
  const extra = state.columns.filter((c) => {
    if (canonical.some((h) => normalizeHeader(h) === normalizeHeader(c))) return false;
    const resolved = resolveCellKey(c, config);
    if (canonicalKeys.has(resolved)) return false;
    return true;
  });
  return [...canonical, ...extra];
}

/** Tahrirlangan qatorlardan yangi .xlsx Blob (import uchun). */
export function buildXlsxBlobFromPreview(
  state: InitialSetupPreviewState,
  config?: StepTableConfig
): Blob {
  const header = importHeaders(state, config);
  const data = state.rows.map((r) =>
    header.map((col) => {
      const key = resolveCellKey(col, config);
      return getCellValue(r.cells, key, config) || r.cells[col] || r.cells[normalizeHeader(col)] || "";
    })
  );
  const aoa = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}
