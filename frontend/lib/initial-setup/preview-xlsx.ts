import * as XLSX from "xlsx";
import type { InitialSetupPreviewRow, InitialSetupPreviewState } from "@/lib/initial-setup/types";
import type { StepTableConfig } from "@/lib/initial-setup/ref-table-config";
import {
  normalizeRowCells,
  resolveCellKey,
  validateRowCells
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
  const columns = headerRow.map((h) => String(h ?? "").trim()).filter((h) => h.length > 0);
  const normKeys = columns.map((c) => normalizeHeader(c));

  const rows: InitialSetupPreviewRow[] = [];
  for (let i = 1; i < matrix.length && rows.length < maxRows; i++) {
    const line = matrix[i] ?? [];
    if (!line.some((c) => String(c ?? "").trim())) continue;
    if (isUnchangedTemplateSampleRow(stepId, columns, line, registry)) continue;
    const rawCells: Record<string, string> = {};
    for (let c = 0; c < normKeys.length; c++) {
      const nk = normKeys[c]!;
      const orig = columns[c]!;
      const v = String(line[c] ?? "").trim();
      rawCells[nk] = v;
      rawCells[orig] = v;
    }
    const cells = normalizeRowCells(rawCells, config);
    const { errors, warnings } = validateRowCells(cells, undefined, config, requiredColumns);
    rows.push({ rowIndex: rows.length + 1, cells, errors, warnings });
  }

  return { columns, rows, fileName: file.name };
}

export function updatePreviewCell(
  state: InitialSetupPreviewState,
  rowIndex: number,
  column: string,
  value: string,
  config?: StepTableConfig
): InitialSetupPreviewState {
  const colKey = resolveCellKey(column, config);
  const rows = state.rows.map((r) => {
    if (r.rowIndex !== rowIndex) return r;
    const cells = normalizeRowCells({ ...r.cells, [colKey]: value, [column]: value }, config);
    const { errors, warnings } = validateRowCells(cells, undefined, config);
    return { ...r, cells, errors, warnings };
  });
  return { ...state, rows };
}

export function previewHasBlockingErrors(state: InitialSetupPreviewState): boolean {
  return state.rows.some((r) => r.errors.length > 0);
}

/** Tahrirlangan qatorlardan yangi .xlsx Blob (import uchun). */
export function buildXlsxBlobFromPreview(
  state: InitialSetupPreviewState,
  config?: StepTableConfig
): Blob {
  const header = state.columns;
  const data = state.rows.map((r) =>
    header.map((col) => {
      const key = resolveCellKey(col, config);
      return r.cells[key] ?? r.cells[col] ?? r.cells[normalizeHeader(col)] ?? "";
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
