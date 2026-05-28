import type { NakladnoyExportPrefs, NakladnoyGroupBy } from "@/lib/order-nakladnoy";
import type { BulkExportCategoryId } from "@/lib/bulk-export-templates";

/** Eksport / «Загруз экспедитор» — har bir shablon uchun. */
export type NakladnoyTemplateSettings = {
  codeColumn: "sku" | "barcode";
  groupBy: NakladnoyGroupBy;
};

/** «Накладные» — maydonlar. */
export type InvoiceTemplateFieldSettings = {
  companyName: boolean;
  contactPerson: boolean;
  clientBalance: boolean;
  printPlaces: boolean;
  inn: boolean;
  largeFont: boolean;
  separation: boolean;
};

/** 112 — Загруз 1.1.2 */
export type Warehouse112Settings = {
  sortProducts: boolean;
};

/** 410 — Загруз 4.1 */
export type Warehouse410Settings = {
  showBarcode: boolean;
  showSku: boolean;
};

/** 600 — Загруз 6.0 */
export type Warehouse600Settings = {
  showLoadDate: boolean;
  showAgents: boolean;
  showTerritory: boolean;
  showExpeditor: boolean;
  showAgentPhone: boolean;
  productsByOrderOnly: boolean;
  showProductId: boolean;
  showProductCode: boolean;
  showProductPrice: boolean;
};

export type WarehouseExportSettings =
  | Warehouse112Settings
  | Warehouse410Settings
  | Warehouse600Settings;

export type BulkExportTemplateSettings =
  | NakladnoyTemplateSettings
  | InvoiceTemplateFieldSettings
  | WarehouseExportSettings;

export type BulkExportSettingsMode =
  | "none"
  | "nakladnoy"
  | "invoice"
  | "warehouse-112"
  | "warehouse-410"
  | "warehouse-600";

export function getTemplateSettingsMode(
  categoryId: BulkExportCategoryId,
  templateId: string
): BulkExportSettingsMode {
  if (categoryId === "expeditor") return "nakladnoy";
  if (categoryId === "invoices") return "invoice";
  if (templateId === "wh-1.1.2") return "warehouse-112";
  if (templateId === "wh-4.1") return "warehouse-410";
  if (templateId === "wh-6.0") return "warehouse-600";
  return "none";
}

export function getCategorySettingsMode(categoryId: BulkExportCategoryId): BulkExportSettingsMode {
  if (categoryId === "expeditor") return "nakladnoy";
  if (categoryId === "invoices") return "invoice";
  return "none";
}

export const DEFAULT_NAKLADNOY_TEMPLATE_SETTINGS: NakladnoyTemplateSettings = {
  codeColumn: "sku",
  groupBy: "agent"
};

export const DEFAULT_INVOICE_TEMPLATE_SETTINGS: InvoiceTemplateFieldSettings = {
  companyName: false,
  contactPerson: false,
  clientBalance: true,
  printPlaces: false,
  inn: false,
  largeFont: false,
  separation: false
};

export const DEFAULT_WAREHOUSE_112_SETTINGS: Warehouse112Settings = {
  sortProducts: true
};

export const DEFAULT_WAREHOUSE_410_SETTINGS: Warehouse410Settings = {
  showBarcode: true,
  showSku: true
};

export const DEFAULT_WAREHOUSE_600_SETTINGS: Warehouse600Settings = {
  showLoadDate: true,
  showAgents: true,
  showTerritory: true,
  showExpeditor: true,
  showAgentPhone: true,
  productsByOrderOnly: true,
  showProductId: true,
  showProductCode: true,
  showProductPrice: true
};

export const INVOICE_FIELD_LABELS: { key: keyof InvoiceTemplateFieldSettings; label: string }[] = [
  { key: "companyName", label: "Название фирмы" },
  { key: "contactPerson", label: "Конт. лицо" },
  { key: "clientBalance", label: "Баланс клиента" },
  { key: "printPlaces", label: "Места для печати" },
  { key: "inn", label: "ИНН" },
  { key: "largeFont", label: "Крупный шрифт" },
  { key: "separation", label: "Разделение" }
];

export const WAREHOUSE_600_FIELD_LABELS: { key: keyof Warehouse600Settings; label: string }[] = [
  { key: "showLoadDate", label: "Дата загруз." },
  { key: "showAgents", label: "Агенты" },
  { key: "showTerritory", label: "Территория" },
  { key: "showExpeditor", label: "Экспедитор" },
  { key: "showAgentPhone", label: "Тел. ТП" },
  { key: "productsByOrderOnly", label: "Товары (только по заказом)" },
  { key: "showProductId", label: "Ид продукта" },
  { key: "showProductCode", label: "Код продукта" },
  { key: "showProductPrice", label: "Цена продукта" }
];

export function defaultTemplateSettings(
  mode: BulkExportSettingsMode
): BulkExportTemplateSettings | undefined {
  if (mode === "nakladnoy") return { ...DEFAULT_NAKLADNOY_TEMPLATE_SETTINGS };
  if (mode === "invoice") return { ...DEFAULT_INVOICE_TEMPLATE_SETTINGS };
  if (mode === "warehouse-112") return { ...DEFAULT_WAREHOUSE_112_SETTINGS };
  if (mode === "warehouse-410") return { ...DEFAULT_WAREHOUSE_410_SETTINGS };
  if (mode === "warehouse-600") return { ...DEFAULT_WAREHOUSE_600_SETTINGS };
  return undefined;
}

export function normalizeNakladnoyTemplateSettings(raw: unknown): NakladnoyTemplateSettings {
  const d = DEFAULT_NAKLADNOY_TEMPLATE_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const codeColumn = o.codeColumn === "barcode" ? "barcode" : "sku";
  let groupBy: NakladnoyGroupBy = "agent";
  if (o.groupBy === "territory" || o.groupBy === "expeditor") groupBy = o.groupBy;
  return { codeColumn, groupBy };
}

export function normalizeInvoiceTemplateSettings(raw: unknown): InvoiceTemplateFieldSettings {
  const d = DEFAULT_INVOICE_TEMPLATE_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const pick = (k: keyof InvoiceTemplateFieldSettings) => o[k] === true;
  return {
    companyName: pick("companyName"),
    contactPerson: pick("contactPerson"),
    clientBalance: o.clientBalance === undefined ? d.clientBalance : pick("clientBalance"),
    printPlaces: pick("printPlaces"),
    inn: pick("inn"),
    largeFont: pick("largeFont"),
    separation: pick("separation")
  };
}

function pickBool(o: Record<string, unknown>, k: string, fallback: boolean): boolean {
  return o[k] === undefined ? fallback : o[k] === true;
}

export function normalizeWarehouse112Settings(raw: unknown): Warehouse112Settings {
  const d = DEFAULT_WAREHOUSE_112_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return { sortProducts: pickBool(o, "sortProducts", d.sortProducts) };
}

export function normalizeWarehouse410Settings(raw: unknown): Warehouse410Settings {
  const d = DEFAULT_WAREHOUSE_410_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    showBarcode: pickBool(o, "showBarcode", d.showBarcode),
    showSku: pickBool(o, "showSku", d.showSku)
  };
}

export function normalizeWarehouse600Settings(raw: unknown): Warehouse600Settings {
  const d = DEFAULT_WAREHOUSE_600_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    showLoadDate: pickBool(o, "showLoadDate", d.showLoadDate),
    showAgents: pickBool(o, "showAgents", d.showAgents),
    showTerritory: pickBool(o, "showTerritory", d.showTerritory),
    showExpeditor: pickBool(o, "showExpeditor", d.showExpeditor),
    showAgentPhone: pickBool(o, "showAgentPhone", d.showAgentPhone),
    productsByOrderOnly: pickBool(o, "productsByOrderOnly", d.productsByOrderOnly),
    showProductId: pickBool(o, "showProductId", d.showProductId),
    showProductCode: pickBool(o, "showProductCode", d.showProductCode),
    showProductPrice: pickBool(o, "showProductPrice", d.showProductPrice)
  };
}

export function normalizeTemplateSettings(
  mode: BulkExportSettingsMode,
  raw: unknown
): BulkExportTemplateSettings | undefined {
  if (mode === "nakladnoy") return normalizeNakladnoyTemplateSettings(raw);
  if (mode === "invoice") return normalizeInvoiceTemplateSettings(raw);
  if (mode === "warehouse-112") return normalizeWarehouse112Settings(raw);
  if (mode === "warehouse-410") return normalizeWarehouse410Settings(raw);
  if (mode === "warehouse-600") return normalizeWarehouse600Settings(raw);
  return undefined;
}

export function mergeNakladnoyPrefsForTemplate(
  globalPrefs: NakladnoyExportPrefs,
  templateSettings: NakladnoyTemplateSettings | undefined
): NakladnoyExportPrefs {
  if (!templateSettings) return globalPrefs;
  return {
    separateSheets: globalPrefs.separateSheets,
    codeColumn: templateSettings.codeColumn,
    groupBy: templateSettings.groupBy
  };
}

export function warehouseSettingsToApiBody(
  templateId: string,
  settings: BulkExportTemplateSettings | undefined
): Record<string, boolean> | undefined {
  if (!settings) return undefined;
  if (templateId === "wh-1.1.2") {
    const s = settings as Warehouse112Settings;
    return { sort_products: s.sortProducts };
  }
  if (templateId === "wh-4.1") {
    const s = settings as Warehouse410Settings;
    return { show_barcode: s.showBarcode, show_sku: s.showSku };
  }
  if (templateId === "wh-6.0") {
    const s = settings as Warehouse600Settings;
    return {
      show_load_date: s.showLoadDate,
      show_agents: s.showAgents,
      show_territory: s.showTerritory,
      show_expeditor: s.showExpeditor,
      show_agent_phone: s.showAgentPhone,
      products_by_order_only: s.productsByOrderOnly,
      show_product_id: s.showProductId,
      show_product_code: s.showProductCode,
      show_product_price: s.showProductPrice
    };
  }
  return undefined;
}
