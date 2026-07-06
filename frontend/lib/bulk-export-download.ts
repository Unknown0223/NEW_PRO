import type { BulkExportTemplateDef } from "@/lib/bulk-export-templates";
import { buildStyledXlsxBuffer } from "@/lib/download-xlsx-styled";
import { fetchExpeditorLoadingLayoutXlsxBlob } from "@/lib/expeditor-loading-download";
import { mergeXlsxSourcesToBuffer, type XlsxSheetSource } from "@/lib/merge-xlsx-workbooks";
import {
  fetchOrdersNakladnoyXlsxBlob,
  type NakladnoyExportPrefs
} from "@/lib/order-nakladnoy";

export type BulkExportDownloadItem = {
  template: BulkExportTemplateDef;
  prefs: NakladnoyExportPrefs;
  warehouseExportOptions?: Record<string, boolean>;
};

export type RegisterSheetData = {
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
};

function uniqueFileName(base: string, used: Set<string>): string {
  const safe = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim() || "file.xlsx";
  const withExt = safe.toLowerCase().endsWith(".xlsx") ? safe : `${safe}.xlsx`;
  if (!used.has(withExt)) {
    used.add(withExt);
    return withExt;
  }
  const dot = withExt.lastIndexOf(".");
  const stem = dot > 0 ? withExt.slice(0, dot) : withExt;
  const ext = dot > 0 ? withExt.slice(dot) : ".xlsx";
  let n = 2;
  while (used.has(`${stem} (${n})${ext}`)) n++;
  const name = `${stem} (${n})${ext}`;
  used.add(name);
  return name;
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const out = filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = out;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2500);
}

async function fetchTemplateBlob(
  tenantSlug: string,
  orderIds: number[],
  item: BulkExportDownloadItem
): Promise<Blob> {
  const { template, prefs, warehouseExportOptions } = item;
  if (template.downloadKind === "register") {
    throw new Error("Register shablonlari registerSheet orqali beriladi.");
  }
  if (!template.apiTemplate) {
    throw new Error(`Shablon yuklanmaydi: ${template.label}`);
  }
  if (template.expeditorLoadingLayout) {
    const { blob } = await fetchExpeditorLoadingLayoutXlsxBlob({
      tenantSlug,
      orderIds,
      layout: template.expeditorLoadingLayout,
      prefs,
      fallbackFilename: `${template.label}.xlsx`
    });
    return blob;
  }
  const { blob } = await fetchOrdersNakladnoyXlsxBlob({
    tenantSlug,
    orderIds,
    template: template.apiTemplate,
    prefs,
    format: "xlsx",
    warehouseLayout: template.warehouseLayout,
    expeditorLoadingLayout: template.expeditorLoadingLayout,
    warehouseExportOptions,
    fallbackFilename: `${template.label}.xlsx`
  });
  return blob;
}

async function downloadAsZip(sources: XlsxSheetSource[], zipName: string): Promise<void> {
  const used = new Set<string>();
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const s of sources) {
    const name = uniqueFileName(`${s.label}.xlsx`, used);
    const data = s.data instanceof Blob ? s.data : s.data;
    zip.file(name, data);
  }
  const zipBlob = await zip.generateAsync({ type: "blob" });
  triggerBlobDownload(zipBlob, zipName);
}

export async function downloadBulkExportSelection(args: {
  tenantSlug: string;
  orderIds: number[];
  items: BulkExportDownloadItem[];
  registerSheet?: RegisterSheetData;
  onProgress?: (done: number, total: number, label: string) => void;
}): Promise<void> {
  const { tenantSlug, orderIds, items, registerSheet, onProgress } = args;
  if (items.length === 0) {
    throw new Error("Hech qanday shablon tanlanmagan.");
  }

  const sources: XlsxSheetSource[] = [];
  const total = items.length;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    onProgress?.(i, total, item.template.label);

    if (item.template.downloadKind === "register") {
      if (!registerSheet) {
        throw new Error("Реестр uchun ma’lumot yo‘q.");
      }
      const buffer = await buildStyledXlsxBuffer("Реестр", registerSheet.headers, registerSheet.rows);
      sources.push({
        label: item.template.label,
        templateId: item.template.id,
        category: item.template.category,
        separateSheets: item.prefs.separateSheets,
        groupBy: item.prefs.groupBy,
        data: buffer
      });
      continue;
    }

    const blob = await fetchTemplateBlob(tenantSlug, orderIds, item);
    sources.push({
      label: item.template.label,
      templateId: item.template.id,
      category: item.template.category,
      separateSheets: item.prefs.separateSheets,
      groupBy: item.prefs.groupBy,
      data: blob
    });
  }

  onProgress?.(total, total, "");

  const day = new Date().toISOString().slice(0, 10);
  const outName = `zagruzka_${day}.xlsx`;

  if (sources.length === 1) {
    const only = sources[0]!;
    const blob =
      only.data instanceof Blob
        ? only.data
        : new Blob([only.data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          });
    triggerBlobDownload(blob, outName);
    return;
  }

  try {
    const merged = await mergeXlsxSourcesToBuffer(sources);
    triggerBlobDownload(
      new Blob([merged], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }),
      outName
    );
  } catch (mergeErr) {
    console.error("[bulk-export] merge failed, fallback zip", mergeErr);
    try {
      await downloadAsZip(sources, `zagruzka_${day}.zip`);
    } catch (zipErr) {
      const mergeMsg = mergeErr instanceof Error ? mergeErr.message : "Birlashtirish xatosi";
      const zipMsg = zipErr instanceof Error ? zipErr.message : "ZIP xatosi";
      throw new Error(`${mergeMsg}. ZIP: ${zipMsg}`);
    }
  }
}
