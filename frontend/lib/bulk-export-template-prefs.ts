import {
  BULK_EXPORT_CATEGORIES,
  type BulkExportCategoryId,
  type BulkExportTemplateDef
} from "@/lib/bulk-export-templates";
import {
  defaultTemplateSettings,
  getTemplateSettingsMode,
  mergeNakladnoyPrefsForTemplate,
  normalizeInvoiceTemplateSettings,
  normalizeNakladnoyTemplateSettings,
  normalizeTemplateSettings,
  warehouseSettingsToApiBody,
  type BulkExportTemplateSettings,
  type InvoiceTemplateFieldSettings,
  type NakladnoyTemplateSettings,
  type WarehouseExportSettings
} from "@/lib/bulk-export-template-settings";
import type { NakladnoyExportPrefs } from "@/lib/order-nakladnoy";

export type BulkExportCategoryPrefs = {
  order: string[];
  enabled: Record<string, boolean>;
  templateSettings: Record<string, BulkExportTemplateSettings>;
};

export type BulkExportPrefsStore = Record<BulkExportCategoryId, BulkExportCategoryPrefs>;

const LS_KEY = "salesdoc.bulk-export-template-prefs-v2";

/** Dastlabki ko‘rinish — mockup bo‘yicha. */
const DEFAULT_ENABLED_BY_CATEGORY: Partial<
  Record<BulkExportCategoryId, Record<string, boolean>>
> = {
  invoices: {
    "inv-macro": false,
    "inv-vat": false,
    "inv-2.1.0": true,
    "inv-2.1.1": true,
    "inv-2.1.2": false,
    "inv-2.1.3": false,
    "inv-2.1.4": false,
    "inv-2.1.5": false,
    "inv-2.1.6": false,
    "inv-2.1.7": true
  },
  expeditor: {
    "ex-2.0": false,
    "ex-3.0": false,
    "ex-4.0.1": false,
    "ex-5.1.1": false,
    "ex-5.1.2": false,
    "ex-5.1.3": false,
    "ex-5.1.4": false,
    "ex-5.1.5": false,
    "ex-5.1.6": true,
    "ex-5.1.7": false,
    "ex-5.1.8": true,
    "ex-5.1.9": false,
    "ex-5.2.0": true
  }
};

function defaultEnabledFor(categoryId: BulkExportCategoryId, templateIds: string[]): Record<string, boolean> {
  const overrides = DEFAULT_ENABLED_BY_CATEGORY[categoryId];
  return Object.fromEntries(
    templateIds.map((id) => [id, overrides?.[id] ?? true])
  );
}

function defaultCategoryPrefs(categoryId: BulkExportCategoryId): BulkExportCategoryPrefs {
  const templates = BULK_EXPORT_CATEGORIES.find((c) => c.id === categoryId)!.templates;
  const templateSettings: Record<string, BulkExportTemplateSettings> = {};
  for (const t of templates) {
    const mode = getTemplateSettingsMode(categoryId, t.id);
    const def = defaultTemplateSettings(mode);
    if (def) templateSettings[t.id] = { ...def } as BulkExportTemplateSettings;
  }
  const ids = templates.map((t) => t.id);
  return {
    order: ids,
    enabled: defaultEnabledFor(categoryId, ids),
    templateSettings
  };
}

export function defaultBulkExportPrefsStore(): BulkExportPrefsStore {
  return {
    warehouse: defaultCategoryPrefs("warehouse"),
    expeditor: defaultCategoryPrefs("expeditor"),
    invoices: defaultCategoryPrefs("invoices"),
    register: defaultCategoryPrefs("register")
  };
}

function mergeCategoryPrefs(
  categoryId: BulkExportCategoryId,
  raw: BulkExportCategoryPrefs | undefined
): BulkExportCategoryPrefs {
  const base = defaultCategoryPrefs(categoryId);
  if (!raw) return base;

  const knownIds = new Set(base.order);
  const order = [
    ...raw.order.filter((id) => knownIds.has(id)),
    ...base.order.filter((id) => !raw.order.includes(id))
  ];
  const enabled: Record<string, boolean> = { ...base.enabled };
  for (const id of order) {
    if (typeof raw.enabled[id] === "boolean") {
      enabled[id] = raw.enabled[id]!;
    }
  }

  const templateSettings: Record<string, BulkExportTemplateSettings> = {
    ...base.templateSettings
  };
  for (const id of order) {
    const rawSettings = raw.templateSettings?.[id];
    const mode = getTemplateSettingsMode(categoryId, id);
    const normalized = normalizeTemplateSettings(mode, rawSettings ?? base.templateSettings[id]);
    if (normalized) templateSettings[id] = normalized;
  }

  return { order, enabled, templateSettings };
}

export function loadBulkExportPrefsStore(): BulkExportPrefsStore {
  const defaults = defaultBulkExportPrefsStore();
  if (typeof window === "undefined") return defaults;
  try {
    const s = window.localStorage.getItem(LS_KEY);
    if (!s) return defaults;
    const parsed = JSON.parse(s) as Partial<BulkExportPrefsStore>;
    return {
      warehouse: mergeCategoryPrefs("warehouse", parsed.warehouse),
      expeditor: mergeCategoryPrefs("expeditor", parsed.expeditor),
      invoices: mergeCategoryPrefs("invoices", parsed.invoices),
      register: mergeCategoryPrefs("register", parsed.register)
    };
  } catch {
    return defaults;
  }
}

export function saveBulkExportPrefsStore(store: BulkExportPrefsStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function getNakladnoySettingsForTemplate(
  store: BulkExportPrefsStore,
  categoryId: BulkExportCategoryId,
  templateId: string
): NakladnoyTemplateSettings | undefined {
  const s = store[categoryId].templateSettings[templateId];
  if (!s || !("codeColumn" in s)) return undefined;
  return normalizeNakladnoyTemplateSettings(s);
}

export function getInvoiceSettingsForTemplate(
  store: BulkExportPrefsStore,
  categoryId: BulkExportCategoryId,
  templateId: string
): InvoiceTemplateFieldSettings | undefined {
  const s = store[categoryId].templateSettings[templateId];
  if (!s || "codeColumn" in s) return undefined;
  return normalizeInvoiceTemplateSettings(s);
}

export function getWarehouseSettingsForTemplate(
  store: BulkExportPrefsStore,
  templateId: string
): WarehouseExportSettings | undefined {
  const s = store.warehouse.templateSettings[templateId];
  if (!s) return undefined;
  const mode = getTemplateSettingsMode("warehouse", templateId);
  if (mode === "warehouse-112" || mode === "warehouse-410" || mode === "warehouse-600") {
    return normalizeTemplateSettings(mode, s) as WarehouseExportSettings;
  }
  return undefined;
}

export function resolveNakladnoyPrefsForDownload(
  store: BulkExportPrefsStore,
  template: BulkExportTemplateDef,
  globalPrefs: NakladnoyExportPrefs
): NakladnoyExportPrefs {
  if (template.category === "expeditor") {
    const perTemplate = getNakladnoySettingsForTemplate(store, template.category, template.id);
    return mergeNakladnoyPrefsForTemplate(globalPrefs, perTemplate);
  }
  return globalPrefs;
}

export function resolveWarehouseExportApiBody(
  store: BulkExportPrefsStore,
  template: BulkExportTemplateDef
): Record<string, boolean> | undefined {
  if (template.category !== "warehouse") return undefined;
  return warehouseSettingsToApiBody(
    template.id,
    store.warehouse.templateSettings[template.id]
  );
}

export function getVisibleTemplates(
  categoryId: BulkExportCategoryId,
  store: BulkExportPrefsStore
): BulkExportTemplateDef[] {
  const category = BULK_EXPORT_CATEGORIES.find((c) => c.id === categoryId)!;
  const prefs = store[categoryId];
  const byId = new Map(category.templates.map((t) => [t.id, t]));
  return prefs.order
    .filter((id) => prefs.enabled[id] !== false)
    .map((id) => byId.get(id))
    .filter((t): t is BulkExportTemplateDef => Boolean(t));
}
