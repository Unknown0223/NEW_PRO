import { api } from "@/lib/api";
import type { ExpeditorLoadingLayoutId } from "@/lib/bulk-export-templates";
import axios from "axios";
import { getUserFacingError } from "@/lib/error-utils";
import type { NakladnoyExportPrefs } from "@/lib/order-nakladnoy";
import { nakladnoyPrefsToApiBody } from "@/lib/order-nakladnoy";

function parseFilenameFromContentDisposition(cd: string | undefined): string | null {
  if (!cd) return null;
  const star = /filename\*=UTF-8''([^;\s]+)/i.exec(cd);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return star[1];
    }
  }
  const m = /filename="([^"]+)"/.exec(cd) ?? /filename=([^;\s]+)/.exec(cd);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1].replace(/"/g, ""));
  } catch {
    return m[1].replace(/"/g, "");
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function parseBlobError(blob: Blob): Promise<string> {
  const text = await blob.text();
  try {
    const j = JSON.parse(text) as { error?: string; message?: string };
    if (j.error === "OrdersNotFound") return "Ba’zi zakazlar topilmadi.";
    return j.message ?? j.error ?? "Xato";
  } catch {
    return text.slice(0, 200) || "Xato";
  }
}

export async function fetchExpeditorLoadingLayoutXlsxBlob(args: {
  tenantSlug: string;
  orderIds: number[];
  layout: ExpeditorLoadingLayoutId;
  prefs: NakladnoyExportPrefs;
  fallbackFilename?: string;
}): Promise<{ blob: Blob; filename: string }> {
  const { tenantSlug, orderIds, layout, prefs, fallbackFilename } = args;
  if (orderIds.length === 0) {
    throw new Error("Zakaz tanlanmagan.");
  }
  try {
    const res = await api.post<Blob>(
      `/api/${tenantSlug}/orders/bulk/nakladnoy/expeditor-loading`,
      {
        order_ids: orderIds,
        expeditor_loading_layout: layout,
        ...nakladnoyPrefsToApiBody(prefs)
      },
      { responseType: "blob" }
    );
    const ct = (res.headers["content-type"] ?? "").toLowerCase();
    if (ct.includes("application/json")) {
      throw new Error(await parseBlobError(res.data as Blob));
    }
    const blob = res.data as Blob;
    const filename =
      parseFilenameFromContentDisposition(res.headers["content-disposition"]) ??
      fallbackFilename ??
      `Загруз зав.склада.xlsx`;
    return { blob, filename };
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
      throw new Error(await parseBlobError(e.response.data));
    }
    throw new Error(getUserFacingError(e, "Excelni yuklab bo‘lmadi."));
  }
}

/**
 * «Загруз зав.склада» shablonlari (5.1.6, 5.2.0, …) — preview bilan bir xil server buffer.
 */
export async function downloadExpeditorLoadingLayoutXlsx(
  args: Parameters<typeof fetchExpeditorLoadingLayoutXlsxBlob>[0]
): Promise<void> {
  const { blob, filename } = await fetchExpeditorLoadingLayoutXlsxBlob(args);
  triggerBlobDownload(blob, filename);
}
