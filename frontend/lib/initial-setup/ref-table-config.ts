import type { InitialSetupStep } from "@/lib/initial-setup/types";
import { normSheetTab, stepIdFromTabLabel } from "@/lib/initial-setup/sheet-labels";
import type { RelationSource } from "@/lib/initial-setup/relation-options";

export type StepTableColumn = {
  key: string;
  header: string;
  required?: boolean;
  /** Raqam maydoni — 3 xonali guruhlash bilan kiritish */
  numeric?: boolean;
  maxFractionDigits?: number;
  /** Avval yaratilgan bog‘liq ma’lumotdan tanlash */
  relation?: RelationSource;
};

export type StepTableMode =
  | "profile"
  | "catalog-create"
  | "import"
  | "company-form"
  | "readonly-api"
  | "entity-create";

export type StepTableConfig = {
  stepId: string;
  mode: StepTableMode;
  profileRefKey?: string;
  /** POST uchun: trade-directions | sales-channels */
  catalogKind?: "trade-directions" | "sales-channels";
  /** Ombor / kategoriya yaratish */
  entityKind?: "warehouses" | "product-categories";
  readonlyQueryKey?: string;
  readonlyFetchPath?: string;
  columns: StepTableColumn[];
  /** Bundle Excel varaq nomi (step id bilan bir xil) */
  sheetName: string;
  /**
   * Fayl/preview ichida unique bo‘lishi kerak bo‘lgan kalit guruhlari.
   * Masalan: [["name"], ["code"]] yoki [["sku", "price_type"]].
   * Bo‘sh qiymatlar o‘tkazib yuboriladi.
   */
  duplicateKeyGroups?: string[][];
};

const REF_COLS: StepTableColumn[] = [
  { key: "name", header: "Название", required: true },
  { key: "code", header: "Код" },
  { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 },
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
    duplicateKeyGroups: [["name"], ["code"]],
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код", required: true },
      { key: "title", header: "Заголовок" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 }
    ]
  },
  {
    stepId: "currencies",
    mode: "profile",
    profileRefKey: "currency_entries",
    sheetName: "currencies",
    duplicateKeyGroups: [["name"], ["code"]],
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код", required: true },
      { key: "is_default", header: "По умолчанию (1/0)", numeric: true, maxFractionDigits: 0 },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 }
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
      { key: "currency_code", header: "Валюта (код)", required: true, relation: "currency-code" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 }
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
      {
        key: "payment_method",
        header: "Способ оплаты",
        relation: "payment-method"
      },
      { key: "kind", header: "Вид (продажа/закупка)" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 }
    ]
  },
  {
    stepId: "trade-directions",
    mode: "catalog-create",
    catalogKind: "trade-directions",
    sheetName: "trade-directions",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 },
      { key: "comment", header: "Комментарий" }
    ]
  },
  {
    stepId: "sales-channels",
    mode: "catalog-create",
    catalogKind: "sales-channels",
    sheetName: "sales-channels",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 },
      { key: "comment", header: "Комментарий" }
    ]
  },
  {
    stepId: "branches",
    mode: "profile",
    profileRefKey: "branches",
    sheetName: "branches",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 }
    ]
  },
  {
    stepId: "client-formats",
    mode: "profile",
    profileRefKey: "client_format_entries",
    sheetName: "client-formats",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 },
      { key: "comment", header: "Комментарий" }
    ]
  },
  {
    stepId: "client-types",
    mode: "profile",
    profileRefKey: "client_type_entries",
    sheetName: "client-types",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 },
      { key: "comment", header: "Комментарий" }
    ]
  },
  {
    stepId: "client-categories",
    mode: "profile",
    profileRefKey: "client_category_entries",
    sheetName: "client-categories",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 },
      { key: "comment", header: "Комментарий" }
    ]
  },
  {
    stepId: "territory",
    mode: "profile",
    profileRefKey: "territory_nodes",
    sheetName: "territory",
    columns: [
      { key: "name", header: "Город", required: true },
      { key: "code", header: "Код города", required: true },
      { key: "region", header: "Название региона", required: true },
      { key: "zone", header: "Зона", required: true }
    ]
  },
  {
    stepId: "warehouses",
    mode: "entity-create",
    sheetName: "warehouses",
    entityKind: "warehouses",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "address", header: "Адрес" }
    ]
  },
  {
    stepId: "product-categories",
    mode: "entity-create",
    sheetName: "product-categories",
    entityKind: "product-categories",
    columns: [
      { key: "name", header: "Название", required: true },
      { key: "code", header: "Код" },
      { key: "parent", header: "Родитель", relation: "product-category-parent" }
    ]
  },
  {
    stepId: "products-catalog",
    mode: "import",
    sheetName: "products-catalog",
    duplicateKeyGroups: [["name"], ["code"]],
    columns: [
      { key: "name", header: "Название *", required: true },
      { key: "code", header: "Код" },
      { key: "category_name", header: "Категория *", required: true, relation: "product-category-name" },
      { key: "unit_name", header: "Единица измерения (название) *", required: true, relation: "unit-name" }
    ]
  },
  {
    stepId: "product-prices",
    mode: "import",
    sheetName: "product-prices",
    duplicateKeyGroups: [["sku", "price_type"]],
    columns: [
      { key: "sku", header: "Артикул (SKU)", required: true, relation: "product-sku" },
      { key: "price_type", header: "Тип цены", relation: "price-type" },
      { key: "price", header: "Цена", required: true, numeric: true, maxFractionDigits: 2 }
    ]
  },
  {
    stepId: "clients",
    mode: "import",
    sheetName: "clients",
    duplicateKeyGroups: [["inn"], ["phone"], ["name"]],
    columns: [
      { key: "name", header: "Наименование", required: true },
      { key: "legal_name", header: "Юридическое название" },
      { key: "address", header: "Адрес" },
      { key: "phone", header: "Телефон" },
      { key: "contact", header: "Контактное лицо" },
      { key: "landmark", header: "Ориентир" },
      { key: "inn", header: "ИНН" },
      { key: "pinfl", header: "ПИНФЛ" },
      { key: "sales_channel_code", header: "Торговый канал (код)", relation: "sales-channel-code" },
      { key: "client_category_code", header: "Категория клиента (код)", relation: "client-category-code" },
      { key: "client_type_code", header: "Тип клиента (код)", relation: "client-type-code" },
      { key: "format_code", header: "Формат (код)", relation: "client-format-code" },
      { key: "city_code", header: "Город (код)", relation: "territory-code" },
      { key: "latitude", header: "Широта", numeric: true, maxFractionDigits: 6 },
      { key: "longitude", header: "Долгота", numeric: true, maxFractionDigits: 6 }
    ]
  },
  {
    stepId: "work-slots",
    mode: "import",
    sheetName: "work-slots",
    duplicateKeyGroups: [["slot_code"]],
    columns: [
      { key: "slot_code", header: "Код слота", required: true },
      { key: "label", header: "Название" },
      { key: "branch_code", header: "Код филиала", relation: "branch-code" },
      { key: "slot_type", header: "Тип слота" },
      { key: "is_active", header: "Активен (да/нет)" },
      { key: "sort_order", header: "Сортировка", numeric: true, maxFractionDigits: 0 },
      { key: "assign_login", header: "Логин агента" }
    ]
  },
  {
    stepId: "stock-receipts",
    mode: "import",
    sheetName: "stock-receipts",
    duplicateKeyGroups: [["warehouse", "sku"]],
    columns: [
      { key: "row_no", header: "№" },
      { key: "warehouse", header: "Склад", required: true, relation: "warehouse-name" },
      { key: "sku", header: "Код товара", required: true, relation: "product-sku" },
      { key: "category", header: "Категория", relation: "product-category-name" },
      { key: "name", header: "Продукт" },
      { key: "price", header: "Цена", numeric: true, maxFractionDigits: 2 },
      { key: "receipt_qty", header: "Количество прихода", required: true, numeric: true, maxFractionDigits: 3 },
      { key: "block_qty", header: "Количество в блоке", numeric: true, maxFractionDigits: 0 }
    ]
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
    склады: "warehouses",
    территория: "territory",
    "формат-клиента": "client-formats",
    "тип-клиента": "client-types",
    "категория-клиента": "client-categories",
    "категории-продуктов": "product-categories",
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
    "product-categories": "product-categories",
    "products-catalog": "products-catalog",
    "product-prices": "product-prices",
    "work-slots": "work-slots",
    "stock-receipts": "stock-receipts",
    warehouses: "warehouses",
    territory: "territory"
  };
  return aliases[norm];
}

export function requiredColumnKeys(step: InitialSetupStep, config?: StepTableConfig): string[] {
  if (step.requiredColumns?.length) return step.requiredColumns;
  return (config?.columns ?? []).filter((c) => c.required).map((c) => c.key);
}
