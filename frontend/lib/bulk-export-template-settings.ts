import type { NakladnoyExportPrefs, NakladnoyGroupBy } from "@/lib/order-nakladnoy";
import type { BulkExportCategoryId } from "@/lib/bulk-export-templates";

/** Eksport / «Загруз экспедитор» — har bir shablon uchun (2-rasm). */
export type NakladnoyTemplateSettings = {
  codeColumn: "sku" | "barcode";
  groupBy: NakladnoyGroupBy;
};

/** «Накладные» — maydonlar (3-rasm). */
export type InvoiceTemplateFieldSettings = {
  companyName: boolean;
  contactPerson: boolean;
  clientBalance: boolean;
  printPlaces: boolean;
  inn: boolean;
  largeFont: boolean;
  separation: boolean;
};

export type BulkExportTemplateSettings =
  | NakladnoyTemplateSettings
  | InvoiceTemplateFieldSettings;

export type BulkExportSettingsMode = "none" | "nakladnoy" | "invoice";

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

export const INVOICE_FIELD_LABELS: { key: keyof InvoiceTemplateFieldSettings; label: string }[] = [
  { key: "companyName", label: "Название фирмы" },
  { key: "contactPerson", label: "Конт. лицо" },
  { key: "clientBalance", label: "Баланс клиента" },
  { key: "printPlaces", label: "Места для печати" },
  { key: "inn", label: "ИНН" },
  { key: "largeFont", label: "Крупный шрифт" },
  { key: "separation", label: "Разделение" }
];

export function defaultTemplateSettings(
  mode: BulkExportSettingsMode
): BulkExportTemplateSettings | undefined {
  if (mode === "nakladnoy") return { ...DEFAULT_NAKLADNOY_TEMPLATE_SETTINGS };
  if (mode === "invoice") return { ...DEFAULT_INVOICE_TEMPLATE_SETTINGS };
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

/** Yuklab olishda: global «Отделить по листам» + shablon sozlamalari. */
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
