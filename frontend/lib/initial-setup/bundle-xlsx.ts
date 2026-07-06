import * as XLSX from "xlsx";
import type { InitialSetupPreviewState } from "@/lib/initial-setup/types";
import {
  sheetNameToStepId,
  getStepTableConfig,
  requiredColumnKeys
} from "@/lib/initial-setup/ref-table-config";
import { parseXlsxPreview } from "@/lib/initial-setup/preview-xlsx";
import { INITIAL_SETUP_STEPS } from "@/lib/initial-setup/catalog";
import type { InitialSetupStep } from "@/lib/initial-setup/types";
import {
  BUNDLE_IMPORT_SHEETS_FALLBACK,
  BUNDLE_REFERENCE_SHEETS,
  SERVER_IMPORT_TEMPLATE_PATHS,
  type BundleTemplateSheet
} from "@/lib/initial-setup/bundle-template-sheets";
import {
  buildStyledSingleSheet,
  buildStyledWorkbook,
  isSkippedTemplateSheet,
  restyleServerSheetBuffer
} from "@/lib/initial-setup/bundle-template-builder";
import { api } from "@/lib/api";
import {
  getCanonicalSampleRegistry,
  registryFromSamplesMetadata,
  TEMPLATE_SAMPLES_SHEET,
  type TemplateSampleRegistry
} from "@/lib/initial-setup/template-sample-matcher";

export type BundleParseResult = Record<string, InitialSetupPreviewState>;

function loadSampleRegistryFromWorkbook(wb: XLSX.WorkBook): TemplateSampleRegistry | null {
  const metaSheet = wb.Sheets[TEMPLATE_SAMPLES_SHEET];
  if (!metaSheet) return null;
  const metaMatrix = XLSX.utils.sheet_to_json<unknown[]>(metaSheet, {
    header: 1,
    defval: ""
  }) as unknown[][];
  return registryFromSamplesMetadata(metaMatrix);
}

async function fetchServerSheet(
  tenantSlug: string,
  stepId: string
): Promise<BundleTemplateSheet | null> {
  const meta = SERVER_IMPORT_TEMPLATE_PATHS[stepId];
  if (!meta) return null;
  try {
    const { data } = await api.get(`/api/${tenantSlug}${meta.path}`, { responseType: "blob" });
    const blob = data instanceof Blob ? data : new Blob([data]);
    const buf = await blob.arrayBuffer();
    return restyleServerSheetBuffer(buf, stepId);
  } catch {
    return null;
  }
}

/** Bitta .xlsx — har bir varaq alohida qadamga. */
export async function parseBundleXlsx(file: File): Promise<BundleParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sampleRegistry = loadSampleRegistryFromWorkbook(wb) ?? getCanonicalSampleRegistry();
  const out: BundleParseResult = {};

  for (const sheetName of wb.SheetNames) {
    if (isSkippedTemplateSheet(sheetName)) continue;
    const stepId = sheetNameToStepId(sheetName);
    if (!stepId) continue;
    const step = INITIAL_SETUP_STEPS.find((s) => s.id === stepId);
    const config = getStepTableConfig(stepId);
    const sheet = wb.Sheets[sheetName]!;
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
    if (!matrix.length) continue;

    const blob = sheetToFile(matrix, `${stepId}.xlsx`);
    const preview = await parseXlsxPreview(
      blob,
      step ? requiredColumnKeys(step, config) : undefined,
      200,
      config,
      sampleRegistry
    );
    if (preview.rows.length) {
      out[stepId] = { ...preview, fileName: file.name };
    }
  }

  return out;
}

function sheetToFile(matrix: unknown[][], fileName: string): File {
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Import");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  return new File([blob], fileName, { type: blob.type });
}

export async function buildBundleTemplateBlob(tenantSlug?: string | null): Promise<Blob> {
  const sheets: BundleTemplateSheet[] = [...BUNDLE_REFERENCE_SHEETS];

  for (const fallback of BUNDLE_IMPORT_SHEETS_FALLBACK) {
    let sheet = fallback;
    if (tenantSlug && SERVER_IMPORT_TEMPLATE_PATHS[fallback.sheetName]) {
      const fromServer = await fetchServerSheet(tenantSlug, fallback.sheetName);
      if (fromServer) sheet = fromServer;
    }
    sheets.push(sheet);
  }

  return buildStyledWorkbook(sheets);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadBundleTemplate(tenantSlug?: string | null) {
  const blob = await buildBundleTemplateBlob(tenantSlug);
  triggerDownload(blob, "nachalnaya-nastroyka-shablon.xlsx");
}

export async function downloadBundleExport(tenantSlug: string) {
  const { data } = await api.get(`/api/${tenantSlug}/settings/initial-setup/export-bundle.xlsx`, {
    responseType: "blob"
  });
  const blob = data instanceof Blob ? data : new Blob([data]);
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `nachalnaya-nastroyka-eksport-${date}.xlsx`);
}

export async function downloadStepTemplate(tenantSlug: string, step: InitialSetupStep) {
  const serverMeta = SERVER_IMPORT_TEMPLATE_PATHS[step.id];
  if (serverMeta && step.importApi?.templatePath) {
    try {
      const { data } = await api.get(`/api/${tenantSlug}${step.importApi.templatePath}`, {
        responseType: "blob"
      });
      const blob = data instanceof Blob ? data : new Blob([data]);
      const buf = await blob.arrayBuffer();
      const sheet = await restyleServerSheetBuffer(buf, step.id);
      if (sheet) {
        triggerDownload(await buildStyledSingleSheet(sheet), step.importApi.templateFilename ?? serverMeta.filename);
        return;
      }
    } catch {
      /* fallback */
    }
  }

  const refSheet = [...BUNDLE_REFERENCE_SHEETS, ...BUNDLE_IMPORT_SHEETS_FALLBACK].find(
    (s) => s.sheetName === step.id
  );
  const config = getStepTableConfig(step.id);
  if (refSheet) {
    triggerDownload(await buildStyledSingleSheet(refSheet), `${step.id}-shablon.xlsx`);
    return;
  }

  if (config && config.mode !== "readonly-api") {
    const headers = config.columns.map((c) => c.header);
    triggerDownload(
      await buildStyledSingleSheet({ sheetName: config.sheetName, rows: [headers] }),
      `${config.sheetName}-shablon.xlsx`
    );
  }
}
