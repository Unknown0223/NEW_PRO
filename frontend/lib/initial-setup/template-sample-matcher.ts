import {
  BUNDLE_IMPORT_SHEETS_FALLBACK,
  BUNDLE_REFERENCE_SHEETS,
  type BundleTemplateSheet
} from "@/lib/initial-setup/bundle-template-sheets";

export const TEMPLATE_SAMPLES_SHEET = "_samples";

export type TemplateSampleRegistry = Map<string, { headers: string[]; samples: string[][] }>;

function normalizeHeader(h: unknown): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, "_")
    .replace(/ё/g, "е");
}

export function normalizeTemplateCell(v: unknown): string {
  return String(v ?? "")
    .trim()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function sheetToRegistry(sheets: BundleTemplateSheet[]): TemplateSampleRegistry {
  const registry: TemplateSampleRegistry = new Map();
  for (const sheet of sheets) {
    const [headers, ...samples] = sheet.rows;
    if (!headers?.length || !samples.length) continue;
    const entry = registry.get(sheet.sheetName) ?? { headers, samples: [] };
    entry.samples.push(...samples);
    registry.set(sheet.sheetName, entry);
  }
  return registry;
}

let canonicalRegistry: TemplateSampleRegistry | null = null;

export function getCanonicalSampleRegistry(): TemplateSampleRegistry {
  if (!canonicalRegistry) {
    canonicalRegistry = sheetToRegistry([...BUNDLE_REFERENCE_SHEETS, ...BUNDLE_IMPORT_SHEETS_FALLBACK]);
  }
  return canonicalRegistry;
}

/** Excel shabloniga yashirin `_samples` varaq qatorlari (yuklab olingan fayl bilan bir xil). */
export function buildSamplesMetadataRows(sheets: BundleTemplateSheet[]): string[][] {
  const rows: string[][] = [["step_id", "col_1", "col_2", "col_3", "col_4", "col_5", "col_6", "col_7", "col_8", "col_9", "col_10", "col_11", "col_12", "col_13", "col_14", "col_15", "col_16"]];
  for (const sheet of sheets) {
    const [, ...samples] = sheet.rows;
    for (const sample of samples) {
      const line = [sheet.sheetName, ...sample];
      while (line.length > 1 && line[line.length - 1] === "") line.pop();
      rows.push(line);
    }
  }
  return rows;
}

export function registryFromSamplesMetadata(matrix: unknown[][]): TemplateSampleRegistry | null {
  if (!matrix.length) return null;
  const header = matrix[0] ?? [];
  const stepCol = header.findIndex((h) => normalizeHeader(h) === "step_id");
  if (stepCol < 0) return null;

  const registry: TemplateSampleRegistry = new Map();
  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const stepId = String(line[stepCol] ?? "").trim();
    if (!stepId) continue;
    const values = line.slice(stepCol + 1).map((c) => String(c ?? "").trim());
    while (values.length && values[values.length - 1] === "") values.pop();
    if (!values.length) continue;

    const entry = registry.get(stepId) ?? { headers: [], samples: [] };
    entry.samples.push(values);
    registry.set(stepId, entry);
  }

  if (registry.size) {
    const canonical = getCanonicalSampleRegistry();
    for (const [stepId, entry] of registry) {
      const canon = canonical.get(stepId);
      if (canon?.headers.length) entry.headers = canon.headers;
    }
  }

  return registry.size ? registry : null;
}

function alignRowToTemplateHeaders(
  uploadCols: string[],
  line: unknown[],
  tmplHeaders: string[]
): string[] {
  const byNorm: Record<string, string> = {};
  for (let i = 0; i < uploadCols.length; i++) {
    byNorm[normalizeHeader(uploadCols[i])] = String(line[i] ?? "").trim();
  }
  return tmplHeaders.map((h) => byNorm[normalizeHeader(h)] ?? "");
}

function rowMatchesSample(uploaded: string[], sample: string[], tmplHeaders: string[]): boolean {
  const colCount = Math.max(tmplHeaders.length, sample.length, uploaded.length);
  for (let i = 0; i < colCount; i++) {
    const u = uploaded[i] ?? "";
    const s = sample[i] ?? "";
    if (normalizeTemplateCell(u) !== normalizeTemplateCell(s)) return false;
  }
  return true;
}

function rowMatchesSamplePositional(line: unknown[], sample: string[]): boolean {
  for (let i = 0; i < sample.length; i++) {
    if (normalizeTemplateCell(line[i]) !== normalizeTemplateCell(sample[i])) return false;
  }
  for (let i = sample.length; i < line.length; i++) {
    if (normalizeTemplateCell(line[i])) return false;
  }
  return true;
}

function rowMatchesAnySample(
  stepId: string,
  columns: string[],
  line: unknown[],
  registry: TemplateSampleRegistry
): boolean {
  const tmpl = registry.get(stepId);
  if (!tmpl?.samples.length) return false;

  if (tmpl.headers.length) {
    const uploaded = alignRowToTemplateHeaders(columns, line, tmpl.headers);
    return tmpl.samples.some((sample) => rowMatchesSample(uploaded, sample, tmpl.headers));
  }

  const uploadedValues = columns.map((_, i) => String(line[i] ?? "").trim());
  return tmpl.samples.some((sample) => rowMatchesSamplePositional(uploadedValues, sample));
}

/** Shablon namunasi o‘zgartirilmagan bo‘lsa — qator bo‘sh deb hisoblanadi. */
export function isUnchangedTemplateSampleRow(
  stepId: string | undefined,
  columns: string[],
  line: unknown[],
  registry?: TemplateSampleRegistry | null
): boolean {
  if (!stepId) return false;
  const reg = registry ?? getCanonicalSampleRegistry();
  if (rowMatchesAnySample(stepId, columns, line, reg)) return true;
  if (registry) return false;
  return false;
}
