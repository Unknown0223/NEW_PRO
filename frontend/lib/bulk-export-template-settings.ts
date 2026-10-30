import type { NakladnoyExportPrefs, NakladnoyGroupBy } from "@/lib/order-nakladnoy";
import type { BulkExportCategoryId } from "@/lib/bulk-export-templates";

/** «Отделить по листам» yoqilganda varaqlar qaysi bo‘yicha ajratiladi. */
export type SheetGroupSettings = {
  groupBy: NakladnoyGroupBy;
};

/** Eksport / «Загруз экспедитор» — har bir shablon uchun. */
export type NakladnoyTemplateSettings = SheetGroupSettings & {
  codeColumn: "sku" | "barcode";
};

/** «Накладные» — maydonlar. */
export type InvoiceTemplateFieldSettings = SheetGroupSettings & {
  companyName: boolean;
  contactPerson: boolean;
  clientBalance: boolean;
  printPlaces: boolean;
  inn: boolean;
  largeFont: boolean;
  separation: boolean;
};

/** «Загруз зав.склада» — alohida sozlamasi yo‘q shablonlar. */
export type WarehouseGroupSettings = SheetGroupSettings;

/** 112 — Загруз 1.1.2 */
export type Warehouse112Settings = SheetGroupSettings & {
  sortProducts: boolean;
};

/** 410 — Загруз 4.1 */
export type Warehouse410Settings = SheetGroupSettings & {
  showBarcode: boolean;
  showSku: boolean;
};

/** 600 — Загруз 6.0 */
export type Warehouse600Settings = SheetGroupSettings & {
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
  | WarehouseGroupSettings
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
  | "warehouse"
  | "warehouse-112"
  | "warehouse-410"
  | "warehouse-600";

export function getTemplateSettingsMode(
  categoryId: BulkExportCategoryId,
  templateId: string
): BulkExportSettingsMode {
  if (categoryId === "expeditor") return "nakladnoy";
  if (categoryId === "invoices") return "invoice";
  if (categoryId !== "warehouse") return "none";
  if (templateId === "wh-1.1.2") return "warehouse-112";
  if (templateId === "wh-4.1") return "warehouse-410";
  if (templateId === "wh-6.0") return "warehouse-600";
  return "warehouse";
}

export function getCategorySettingsMode(categoryId: BulkExportCategoryId): BulkExportSettingsMode {
  if (categoryId === "expeditor") return "nakladnoy";
  if (categoryId === "invoices") return "invoice";
  if (categoryId === "warehouse") return "warehouse";
  return "none";
}

const DEFAULT_GROUP_BY: NakladnoyGroupBy = "agent";

export const DEFAULT_NAKLADNOY_TEMPLATE_SETTINGS: NakladnoyTemplateSettings = {
  codeColumn: "sku",
  groupBy: DEFAULT_GROUP_BY
};

export const DEFAULT_WAREHOUSE_GROUP_SETTINGS: WarehouseGroupSettings = {
  groupBy: DEFAULT_GROUP_BY
};

export const DEFAULT_INVOICE_TEMPLATE_SETTINGS: InvoiceTemplateFieldSettings = {
  groupBy: DEFAULT_GROUP_BY,
  companyName: false,
  contactPerson: false,
  clientBalance: true,
  printPlaces: false,
  inn: false,
  largeFont: false,
  separation: false
};

export const DEFAULT_WAREHOUSE_112_SETTINGS: Warehouse112Settings = {
  groupBy: DEFAULT_GROUP_BY,
  sortProducts: true
};

export const DEFAULT_WAREHOUSE_410_SETTINGS: Warehouse410Settings = {
  groupBy: DEFAULT_GROUP_BY,
  showBarcode: true,
  showSku: true
};

export const DEFAULT_WAREHOUSE_600_SETTINGS: Warehouse600Settings = {
  groupBy: DEFAULT_GROUP_BY,
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

export const INVOICE_FIELD_LABELS: {
  key: Exclude<keyof InvoiceTemplateFieldSettings, "groupBy">;
  label: string;
}[] = [
  { key: "companyName", label: "Название фирмы" },
  { key: "contactPerson", label: "Конт. лицо" },
  { key: "clientBalance", label: "Баланс клиента" },
  { key: "printPlaces", label: "Места для печати" },
  { key: "inn", label: "ИНН" },
  { key: "largeFont", label: "Крупный шрифт" },
  { key: "separation", label: "Разделение" }
];

export const WAREHOUSE_600_FIELD_LABELS: {
  key: Exclude<keyof Warehouse600Settings, "groupBy">;
  label: string;
}[] = [
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
  if (mode === "warehouse") return { ...DEFAULT_WAREHOUSE_GROUP_SETTINGS };
  if (mode === "warehouse-112") return { ...DEFAULT_WAREHOUSE_112_SETTINGS };
  if (mode === "warehouse-410") return { ...DEFAULT_WAREHOUSE_410_SETTINGS };
  if (mode === "warehouse-600") return { ...DEFAULT_WAREHOUSE_600_SETTINGS };
  return undefined;
}

function normalizeGroupBy(raw: unknown): NakladnoyGroupBy {
  return raw === "territory" || raw === "expeditor" ? raw : DEFAULT_GROUP_BY;
}

export function normalizeNakladnoyTemplateSettings(raw: unknown): NakladnoyTemplateSettings {
  const d = DEFAULT_NAKLADNOY_TEMPLATE_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const codeColumn = o.codeColumn === "barcode" ? "barcode" : "sku";
  return { codeColumn, groupBy: normalizeGroupBy(o.groupBy) };
}

export function normalizeWarehouseGroupSettings(raw: unknown): WarehouseGroupSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WAREHOUSE_GROUP_SETTINGS };
  return { groupBy: normalizeGroupBy((raw as Record<string, unknown>).groupBy) };
}

export function normalizeInvoiceTemplateSettings(raw: unknown): InvoiceTemplateFieldSettings {
  const d = DEFAULT_INVOICE_TEMPLATE_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const pick = (k: keyof InvoiceTemplateFieldSettings) => o[k] === true;
  return {
    groupBy: normalizeGroupBy(o.groupBy),
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
  return {
    groupBy: normalizeGroupBy(o.groupBy),
    sortProducts: pickBool(o, "sortProducts", d.sortProducts)
  };
}

export function normalizeWarehouse410Settings(raw: unknown): Warehouse410Settings {
  const d = DEFAULT_WAREHOUSE_410_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    groupBy: normalizeGroupBy(o.groupBy),
    showBarcode: pickBool(o, "showBarcode", d.showBarcode),
    showSku: pickBool(o, "showSku", d.showSku)
  };
}

export function normalizeWarehouse600Settings(raw: unknown): Warehouse600Settings {
  const d = DEFAULT_WAREHOUSE_600_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  return {
    groupBy: normalizeGroupBy(o.groupBy),
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
  if (mode === "warehouse") return normalizeWarehouseGroupSettings(raw);
  if (mode === "warehouse-112") return normalizeWarehouse112Settings(raw);
  if (mode === "warehouse-410") return normalizeWarehouse410Settings(raw);
  if (mode === "warehouse-600") return normalizeWarehouse600Settings(raw);
  return undefined;
}

/**
 * Shablon sozlamasi global prefs ustidan: «тип фильтрации» hamma bo‘limda,
 * «тип кода» faqat «Загруз экспедитор» shablonlarida.
 */
export function mergeNakladnoyPrefsForTemplate(
  globalPrefs: NakladnoyExportPrefs,
  templateSettings: Partial<NakladnoyTemplateSettings> | undefined
): NakladnoyExportPrefs {
  if (!templateSettings) return globalPrefs;
  return {
    separateSheets: globalPrefs.separateSheets,
    codeColumn: templateSettings.codeColumn ?? globalPrefs.codeColumn,
    groupBy: templateSettings.groupBy ?? globalPrefs.groupBy
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
