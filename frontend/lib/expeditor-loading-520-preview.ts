import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import type { NakladnoyExportPrefs } from "@/lib/order-nakladnoy";
import { nakladnoyPrefsToApiBody } from "@/lib/order-nakladnoy";

export type ExpeditorLoading520PreviewLine = {
  num: number;
  code: string;
  name: string;
  qty: number | null;
  bonus: number | null;
  price: string;
  sum: string;
};

export type ExpeditorLoading520PreviewGroup = {
  name: string;
  qty: number;
  bonus: number;
  sum: string;
  lines: ExpeditorLoading520PreviewLine[];
};

export type ExpeditorLoading520Preview = {
  versionLabel: string;
  title: string;
  printedAt: string;
  filename: string;
  meta: {
    dateOrder: string;
    dateShip: string | null;
    agents: string;
    agentPhones: string;
    agentPhonesVisible: boolean;
    territory: string;
    expeditor: string | null;
    expeditorVisible: boolean;
    currency: string;
  };
  groups: ExpeditorLoading520PreviewGroup[];
  totals: {
    qty: number;
    bonus: number;
    sum: string;
  };
};

function apiBody(orderIds: number[], prefs: NakladnoyExportPrefs) {
  return {
    order_ids: orderIds,
    ...nakladnoyPrefsToApiBody(prefs)
  };
}

export async function fetchExpeditorLoading520Preview(args: {
  tenantSlug: string;
  orderIds: number[];
  prefs: NakladnoyExportPrefs;
}): Promise<ExpeditorLoading520Preview> {
  const { tenantSlug, orderIds, prefs } = args;
  if (orderIds.length === 0) {
    throw new Error("Zakaz tanlanmagan.");
  }
  try {
    const { data } = await api.post<{ pages: Array<{ loading520?: ExpeditorLoading520Preview }> }>(
      `/api/${tenantSlug}/orders/bulk/nakladnoy/preview`,
      {
        ...apiBody(orderIds, prefs),
        template: "nakladnoy_expeditor",
        label: "Загруз зав.склада 5.2.0",
        expeditor_loading_layout: "ex-5.2.0"
      }
    );
    const doc = data.pages[0]?.loading520;
    if (!doc) throw new Error("Preview bo‘sh.");
    return doc;
  } catch (e: unknown) {
    throw new Error(getUserFacingError(e, "Ko‘rinishni yuklab bo‘lmadi."));
  }
}

/** @deprecated — `downloadExpeditorLoadingLayoutXlsx` ishlating */
export async function downloadExpeditorLoading520Xlsx(args: {
  tenantSlug: string;
  orderIds: number[];
  prefs: NakladnoyExportPrefs;
  fallbackFilename?: string;
}): Promise<void> {
  const { downloadExpeditorLoadingLayoutXlsx } = await import("@/lib/expeditor-loading-download");
  return downloadExpeditorLoadingLayoutXlsx({ ...args, layout: "ex-5.2.0" });
}
