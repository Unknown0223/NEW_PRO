import type { InitialSetupStep } from "@/lib/initial-setup/types";
import { normSheetTab, stepIdFromTabLabel } from "@/lib/initial-setup/sheet-labels";

export type StepTableColumn = {
  key: string;
  header: string;
  required?: boolean;
};

export type StepTableMode =
  | "profile"
  | "catalog-create"
  | "import"
  | "company-form"
  | "readonly-api";

export type StepTableConfig = {
  stepId: string;
  mode: StepTableMode;
  profileRefKey?: string;
  /** POST uchun: trade-directions | sales-channels */
  catalogKind?: "trade-directions" | "sales-channels";
  readonlyQueryKey?: string;
  readonlyFetchPath?: string;
  columns: StepTableColumn[];
  /** Bundle Excel varaq nomi (step id bilan bir xil) */
  sheetName: string;
};

const REF_COLS: StepTableColumn[] = [
  { key: "name", header: "Название", required: true },
  { key: "code", header: "Код" },
  { key: "sort_order", header: "Сортировка" },
  { key: "comment", header: "Комментарий" }
];

export const STEP_TABLE_CONFIGS: StepTableConfig[] = [
  {
    stepId: "company",
    mode: "company-form",
    sheetName: "company",
    columns: [
      { key: "name", header: "Название организации", required: true },
      { key: "phone", header: "Телефон" },
      { key: "address", header: "Адрес" }
    ]
  },
  {
    stepId: "units",
    mode: "profile",
    profileRefKey: "unit_measures",
    sheetName: "units",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код", required: true },
      { key: "title", header: "Заголовок" },
      { key: "sort_order", header: "Сортировка" }
    ]
  },
  {
    stepId: "currencies",
    mode: "profile",
    profileRefKey: "currency_entries",
    sheetName: "currencies",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код", required: true },
      { key: "is_default", header: "По умолчанию (1/0)" },
      { key: "sort_order", header: "Сортировка" }
    ]
  },
  {
    stepId: "payment-methods",
    mode: "profile",
    profileRefKey: "payment_method_entries",
    sheetName: "payment-methods",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "currency_code", header: "Валюта (код)", required: true },
      { key: "sort_order", header: "Сортировка" }
    ]
  },
  {
    stepId: "price-types",
    mode: "profile",
    profileRefKey: "price_type_entries",
    sheetName: "price-types",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код", required: true },
      { key: "sort_order", header: "Сортировка" }
    ]
  },
  {
    stepId: "trade-directions",
    mode: "catalog-create",
    catalogKind: "trade-directions",
    sheetName: "trade-directions",
    columns: REF_COLS
  },
  {
    stepId: "sales-channels",
    mode: "catalog-create",
    catalogKind: "sales-channels",
    sheetName: "sales-channels",
    columns: REF_COLS
  },
  {
    stepId: "branches",
    mode: "profile",
    profileRefKey: "branches",
    sheetName: "branches",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "sort_order", header: "Сортировка" }
    ]
  },
  {
    stepId: "client-formats",
    mode: "profile",
    profileRefKey: "client_format_entries",
    sheetName: "client-formats",
    columns: REF_COLS
  },
  {
    stepId: "client-types",
    mode: "profile",
    profileRefKey: "client_type_entries",
    sheetName: "client-types",
    columns: REF_COLS
  },
  {
    stepId: "client-categories",
    mode: "profile",
    profileRefKey: "client_category_entries",
    sheetName: "client-categories",
    columns: REF_COLS
  },
  {
    stepId: "territory",
    mode: "readonly-api",
    sheetName: "territory",
    readonlyQueryKey: "settings-profile-territory",
    columns: [
      { key: "name", header: "Название" },
      { key: "level", header: "Уровень" },
      { key: "parent", header: "Родитель" }
    ]
  },
  {
    stepId: "warehouses",
    mode: "readonly-api",
    sheetName: "warehouses",
    readonlyQueryKey: "reference-warehouses",
    readonlyFetchPath: "/warehouses",
    columns: [
      { key: "name", header: "Название" },
      { key: "code", header: "Код" },
      { key: "branch", header: "Филиал" }
    ]
  },
  {
    stepId: "product-categories",
    mode: "readonly-api",
    sheetName: "product-categories",
    readonlyQueryKey: "product-categories",
    readonlyFetchPath: "/product-categories",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "parent", header: "Родитель" }
    ]
  },
  {
    stepId: "products-catalog",
    mode: "import",
    sheetName: "products-catalog",
    columns: [
      { key: "name", header: "Название *", required: true },
      { key: "code", header: "Код" },
      { key: "category_code", header: "Категория(код) *", required: true },
      { key: "unit_code", header: "Единица измерения(код) *", required: true }
    ]
  },
  {
    stepId: "product-prices",
    mode: "import",
    sheetName: "product-prices",
    columns: [
      { key: "sku", header: "Артикул (SKU)", required: true },
      { key: "price_type", header: "Тип цены" },
      { key: "price", header: "Цена", required: true }
    ]
  },
  {
    stepId: "clients",
    mode: "import",
    sheetName: "clients",
    columns: [{ key: "name", header: "Наименование", required: true }]
  },
  {
    stepId: "work-slots",
    mode: "import",
    sheetName: "work-slots",
    columns: [{ key: "slot_code", header: "slot_code", required: true }]
  },
  {
    stepId: "stock-receipts",
    mode: "import",
    sheetName: "stock-receipts",
    columns: []
  }
];

export function getStepTableConfig(stepId: string): StepTableConfig | undefined {
  return STEP_TABLE_CONFIGS.find((c) => c.stepId === stepId);
}

export function sheetNameToStepId(sheetName: string): string | undefined {
  const fromTab = stepIdFromTabLabel(sheetName);
  if (fromTab) return fromTab;

  const norm = normSheetTab(sheetName);
  const direct = STEP_TABLE_CONFIGS.find((c) => c.sheetName === norm || c.stepId === norm);
  if (direct) return direct.stepId;

  const aliases: Record<string, string> = {
    единицы: "units",
    "единицы-измерения": "units",
    валюты: "currencies",
    "способ-оплаты": "payment-methods",
    "способы-оплаты": "payment-methods",
    "типы-цен": "price-types",
    направление: "trade-directions",
    "направление-торговли": "trade-directions",
    "канал-продаж": "sales-channels",
    филиалы: "branches",
    "формат-клиента": "client-formats",
    "тип-клиента": "client-types",
    "категория-клиента": "client-categories",
    продукты: "products-catalog",
    цены: "product-prices",
    клиенты: "clients",
    слоты: "work-slots",
    поступление: "stock-receipts",
    остатки: "stock-receipts",
    компания: "company",
    "payment-methods": "payment-methods",
    "price-types": "price-types",
    "trade-directions": "trade-directions",
    "sales-channels": "sales-channels",
    "client-formats": "client-formats",
    "client-types": "client-types",
    "client-categories": "client-categories",
    "products-catalog": "products-catalog",
    "product-prices": "product-prices",
    "work-slots": "work-slots",
    "stock-receipts": "stock-receipts"
  };
  return aliases[norm];
}

export function requiredColumnKeys(step: InitialSetupStep, config?: StepTableConfig): string[] {
  if (step.requiredColumns?.length) return step.requiredColumns;
  return (config?.columns ?? []).filter((c) => c.required).map((c) => c.key);
}
