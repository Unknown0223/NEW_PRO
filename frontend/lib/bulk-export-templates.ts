import type { NakladnoyTemplateId } from "@/lib/order-nakladnoy";

/** Backend `warehouse_layout` — «Загруз зав.склада» 13 shablon */
export type WarehouseLayoutId =
  | "wh-1.1"
  | "wh-1.1.2"
  | "wh-4.1"
  | "wh-4.1.1"
  | "wh-4.1.2"
  | "wh-6.0"
  | "wh-6.0.1"
  | "wh-6.0.2"
  | "wh-7.0.0"
  | "wh-7.0.1"
  | "wh-xprinter"
  | "wh-7.0.3"
  | "wh-7.0.4";

export type BulkExportCategoryId = "warehouse" | "expeditor" | "invoices" | "register";

export type BulkExportDownloadKind = "nakladnoy" | "register";

export type BulkExportTemplateDef = {
  id: string;
  label: string;
  category: BulkExportCategoryId;
  downloadKind: BulkExportDownloadKind;
  apiTemplate?: NakladnoyTemplateId;
  /** «Загруз зав.склада» — alohida Excel andoza */
  warehouseLayout?: WarehouseLayoutId;
};

export type BulkExportCategoryDef = {
  id: BulkExportCategoryId;
  title: string;
  templates: BulkExportTemplateDef[];
};

const warehouseTemplates: BulkExportTemplateDef[] = [
  { id: "wh-1.1", label: "Загруз зав.склада 1.1", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-1.1" },
  { id: "wh-1.1.2", label: "Загруз зав.склада 1.1.2", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-1.1.2" },
  { id: "wh-4.1", label: "Загруз зав.склада 4.1", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-4.1" },
  { id: "wh-4.1.1", label: "Загруз зав.склада 4.1.1", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-4.1.1" },
  { id: "wh-4.1.2", label: "Загруз зав.склада 4.1.2", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-4.1.2" },
  { id: "wh-6.0", label: "Загруз зав.склада 6.0", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-6.0" },
  { id: "wh-6.0.1", label: "Загруз зав.склада 6.0.1", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-6.0.1" },
  { id: "wh-6.0.2", label: "Загруз зав.склада 6.0.2", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-6.0.2" },
  { id: "wh-7.0.0", label: "Загруз зав.склада 7.0.0", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-7.0.0" },
  { id: "wh-7.0.1", label: "Загруз зав.склада 7.0.1", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-7.0.1" },
  { id: "wh-xprinter", label: "Загруз X-Printer 80мм", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-xprinter" },
  { id: "wh-7.0.3", label: "Загруз зав.склада 7.0.3", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-7.0.3" },
  { id: "wh-7.0.4", label: "Загруз зав.склада 7.0.4", category: "warehouse", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse", warehouseLayout: "wh-7.0.4" }
];

const expeditorTemplates: BulkExportTemplateDef[] = [
  { id: "ex-3.0", label: "Загруз зав.склада 3.0", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-4.0.1", label: "Загруз зав.склада 4.0.1", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-4.1.0", label: "Загруз зав.склада 4.1.0", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-5.0", label: "Загруз зав.склада 5.0", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-5.0.6", label: "Загруз зав.склада 5.0.6", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-5.1.0", label: "Загруз зав.склада 5.1.0", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-5.1.0.1", label: "Загруз зав.склада 5.1.0.1", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-5.1.6", label: "Загруз зав.склада 5.1.6", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-5.1.8", label: "Загруз зав.склада 5.1.8", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "ex-5.2.0", label: "Загруз зав.склада 5.2.0", category: "expeditor", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" }
];

const invoiceTemplates: BulkExportTemplateDef[] = [
  { id: "inv-macro", label: "Макро накладной", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse" },
  { id: "inv-vat", label: "Счет фактура с НДС", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_warehouse" },
  { id: "inv-2.1.0", label: "Накладные 2.1.0", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "inv-2.1.1", label: "Накладные 2.1.1", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "inv-2.1.2", label: "Накладные 2.1.2", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "inv-2.1.3", label: "Накладные 2.1.3", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "inv-2.1.4", label: "Накладные 2.1.4", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "inv-2.1.5", label: "Накладные 2.1.5", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "inv-2.1.6", label: "Накладные 2.1.6", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" },
  { id: "inv-2.1.7", label: "Накладные 2.1.7", category: "invoices", downloadKind: "nakladnoy", apiTemplate: "nakladnoy_expeditor" }
];

const registerTemplates: BulkExportTemplateDef[] = [
  { id: "reg-1.0", label: "Реестр 1.0", category: "register", downloadKind: "register" },
  { id: "reg-2.0", label: "Реестр 2.0", category: "register", downloadKind: "register" },
  { id: "reg-3.0", label: "Реестр 3.0", category: "register", downloadKind: "register" },
  { id: "reg-3.0.1", label: "Реестр 3.0.1", category: "register", downloadKind: "register" },
  { id: "reg-4.0", label: "Реестр 4.0", category: "register", downloadKind: "register" },
  { id: "reg-5.0", label: "Реестр 5.0", category: "register", downloadKind: "register" }
];

export const BULK_EXPORT_CATEGORIES: BulkExportCategoryDef[] = [
  { id: "warehouse", title: "Загруз зав.склада", templates: warehouseTemplates },
  { id: "expeditor", title: "Загруз экспедитор", templates: expeditorTemplates },
  { id: "invoices", title: "Накладные", templates: invoiceTemplates },
  { id: "register", title: "Реестр", templates: registerTemplates }
];

export function getBulkExportCategory(id: BulkExportCategoryId): BulkExportCategoryDef {
  return BULK_EXPORT_CATEGORIES.find((c) => c.id === id)!;
}

export function findBulkExportTemplate(
  categoryId: BulkExportCategoryId,
  templateId: string
): BulkExportTemplateDef | undefined {
  return getBulkExportCategory(categoryId).templates.find((t) => t.id === templateId);
}
