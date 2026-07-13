import type { InitialSetupGroup, InitialSetupStep } from "@/lib/initial-setup/types";

/**
 * Boshlang‘ich sozlash — foydalanuvchilar (xodimlar) va bonus/skidka qoidalari kiritilmaydi.
 * Bonus/skidka — alohida «Sozlamalar» guruhi (keyinroq qo‘lda).
 */
export const INITIAL_SETUP_STEPS: InitialSetupStep[] = [
  {
    id: "company",
    title: "Компания",
    description: "Название организации, ИНН, контакты — отображаются в документах и отчётах.",
    dependsOn: [],
    kind: "manual",
    settingsHref: "/settings/company",
    order: 10
  },
  {
    id: "territory",
    title: "Территория (зоны, регионы, города)",
    description:
      "Дерево территорий для клиентов, визитов и слотов. Можно загрузить образец Lalaku или заполнить вручную.",
    dependsOn: [],
    dependencyHint: "Клиенты и слоты привязываются к городам/зонам из этого справочника.",
    kind: "manual",
    settingsHref: "/settings/territories",
    order: 20
  },
  {
    id: "branches",
    title: "Филиалы",
    description: "Филиалы компании — для агентов, складов и отчётов.",
    dependsOn: [],
    kind: "manual",
    settingsHref: "/settings/branches",
    order: 30
  },
  {
    id: "units",
    title: "Единицы измерения",
    description: "шт, кг, л и др. — обязательны при импорте каталога продуктов.",
    dependsOn: [],
    dependencyHint: "Перед импортом продуктов из Excel коды единиц должны существовать.",
    kind: "manual",
    settingsHref: "/settings/units",
    order: 40
  },
  {
    id: "currencies",
    title: "Валюты",
    description: "Валюты для цен и оплат.",
    dependsOn: [],
    kind: "manual",
    settingsHref: "/settings/currencies",
    order: 50
  },
  {
    id: "payment-methods",
    title: "Способы оплаты",
    description: "Наличные, перечисление, карта и т.д.",
    dependsOn: ["currencies"],
    kind: "manual",
    settingsHref: "/settings/payment-methods",
    order: 60
  },
  {
    id: "price-types",
    title: "Типы цен",
    description: "Опт, розница, дилер — для прайс-листа и заказов.",
    dependsOn: ["currencies"],
    kind: "manual",
    settingsHref: "/settings/price-types",
    order: 70
  },
  {
    id: "trade-directions",
    title: "Направление торговли",
    description: "Направления продаж (каналы дистрибуции верхнего уровня).",
    dependsOn: [],
    kind: "manual",
    settingsHref: "/settings/sales-directions/trade",
    order: 80
  },
  {
    id: "sales-channels",
    title: "Канал продаж",
    description: "Каналы для клиентов (импорт клиентов сопоставляет по названию/коду).",
    dependsOn: ["trade-directions"],
    dependencyHint: "Колонка «канал продаж» в Excel клиентов сопоставляется с этим справочником.",
    kind: "manual",
    settingsHref: "/settings/sales-directions/sales-channels",
    order: 90
  },
  {
    id: "warehouses",
    title: "Склады",
    description: "Склады для остатков, приходов и заказов. Создаются вручную (Excel-импорта нет).",
    dependsOn: ["branches"],
    kind: "manual",
    settingsHref: "/stock/warehouses",
    order: 100
  },
  {
    id: "client-formats",
    title: "Формат клиента",
    description: "Форматы торговых точек (супермаркет, киоск и т.д.).",
    dependsOn: [],
    kind: "manual",
    settingsHref: "/settings/client-formats",
    order: 110
  },
  {
    id: "client-types",
    title: "Тип клиента",
    description: "Типы клиентов для классификации и отчётов.",
    dependsOn: [],
    kind: "manual",
    settingsHref: "/settings/client-types",
    order: 120
  },
  {
    id: "client-categories",
    title: "Категория клиента",
    description: "Категории клиентов — сопоставляются при импорте Excel.",
    dependsOn: [],
    dependencyHint: "Рекомендуется заполнить до импорта клиентов — иначе значения сохранятся как текст с предупреждением.",
    kind: "manual",
    settingsHref: "/settings/client-categories",
    order: 130
  },
  {
    id: "product-categories",
    title: "Категории продуктов",
    description: "Дерево категорий с кодами — коды используются в Excel каталога.",
    dependsOn: ["units"],
    kind: "manual",
    settingsHref: "/settings/product-categories",
    order: 200
  },
  {
    id: "products-catalog",
    title: "Каталог продуктов (Excel)",
    description:
      "Полный импорт: название, категория (код), единица (код), SKU, штрихкод, бренд и др.",
    dependsOn: ["units", "product-categories"],
    dependencyHint: "Категория и единица — по коду из справочников выше.",
    kind: "excel-import",
    settingsHref: "/settings/products/excel",
    importApi: {
      templatePath: "/products/import-template",
      templateFilename: "import-products-template.xlsx",
      importPath: "/products/import-catalog",
      importAsyncPath: "/products/import-catalog/async"
    },
    requiredColumns: ["name", "sku"],
    order: 210
  },
  {
    id: "product-prices",
    title: "Цены продуктов (Excel)",
    description: "Прайс по SKU и типу цены. Продукты должны уже существовать.",
    dependsOn: ["products-catalog", "price-types"],
    kind: "excel-import",
    settingsHref: "/settings/prices/price-list",
    importApi: {
      importPath: "/products/prices/import",
      importAsyncPath: "/products/prices/import/async"
    },
    requiredColumns: ["sku"],
    order: 220
  },
  {
    id: "clients",
    title: "Клиенты (Excel)",
    description:
      "Импорт торговых точек. Минимум — название; телефон и координаты рекомендуются. Агенты — только если есть колонки назначения.",
    dependsOn: [
      "territory",
      "client-formats",
      "client-types",
      "client-categories",
      "sales-channels"
    ],
    dependencyHint:
      "Справочники клиентов и территория — для корректного сопоставления. Сотрудников (агентов) добавляют отдельно в «Справочники → Пользователи».",
    kind: "excel-import",
    settingsHref: "/clients",
    importApi: {
      templatePath: "/clients/import/template",
      templateFilename: "clients-import-template.xlsx",
      importPath: "/clients/import",
      importAsyncPath: "/clients/import/async"
    },
    requiredColumns: ["name"],
    order: 300
  },
  {
    id: "work-slots",
    title: "Слоты / территория агентов (Excel)",
    description: "Привязка агентов к территории и дням визита. Нужны агенты и территория.",
    dependsOn: ["territory", "clients"],
    dependencyHint: "Агенты создаются вручную: Настройки → Справочники → Агент.",
    kind: "excel-import",
    importApi: {
      importPath: "/work-slots/import.xlsx"
    },
    order: 310
  },
  {
    id: "stock-receipts",
    title: "Начальные остатки / приход (Excel)",
    description: "Опционально: начальный приход на склад. Нужны склады и продукты.",
    dependsOn: ["warehouses", "products-catalog"],
    kind: "excel-import",
    settingsHref: "/stock",
    importApi: {
      templatePath: "/stock/import-template?kind=postupleniya2",
      templateFilename: "stock-import-template.xlsx",
      importPath: "/stock/import",
      importAsyncPath: "/stock/import/async"
    },
    order: 320
  }
];

/** Bonus, skidka va boshqalar — sozlamalarda alohida */
export const INITIAL_SETUP_SETTINGS_ONLY: InitialSetupStep[] = [
  {
    id: "bonus-rules",
    title: "Бонусы",
    description: "Правила бонусов — настраиваются после базовых данных и продуктов.",
    dependsOn: ["products-catalog", "clients"],
    kind: "info",
    settingsHref: "/settings/bonus-rules",
    order: 900
  },
  {
    id: "discount-rules",
    title: "Скидки",
    description: "Правила скидок — отдельно от начального импорта.",
    dependsOn: ["products-catalog", "clients"],
    kind: "info",
    settingsHref: "/settings/discount-rules",
    order: 910
  },
  {
    id: "bonus-stack",
    title: "RLP бонусы",
    description: "Стек бонусных программ.",
    dependsOn: ["bonus-rules"],
    kind: "info",
    settingsHref: "/settings/bonus-stack",
    order: 920
  },
  {
    id: "staff",
    title: "Пользователи (агенты, экспедиторы…)",
    description:
      "Сотрудники не импортируются в этом мастере. Создайте в Справочниках, затем при необходимости назначьте клиентам.",
    dependsOn: ["branches", "warehouses"],
    kind: "info",
    settingsHref: "/settings/spravochnik",
    order: 930
  }
];

export const INITIAL_SETUP_GROUPS: InitialSetupGroup[] = [
  {
    id: "foundation",
    title: "1. Основа",
    subtitle: "Территория, филиалы, финансы, склады",
    stepIds: [
      "company",
      "territory",
      "branches",
      "units",
      "currencies",
      "payment-methods",
      "price-types",
      "trade-directions",
      "sales-channels",
      "warehouses"
    ],
    inColdStartFlow: true
  },
  {
    id: "client-refs",
    title: "2. Справочники клиента",
    subtitle: "Перед импортом клиентов",
    stepIds: ["client-formats", "client-types", "client-categories"],
    inColdStartFlow: true
  },
  {
    id: "products",
    title: "3. Продукты и цены",
    subtitle: "Категории → каталог → прайс",
    stepIds: ["product-categories", "products-catalog", "product-prices"],
    inColdStartFlow: true
  },
  {
    id: "operations",
    title: "4. Клиенты и операции",
    subtitle: "Импорт клиентов и опционально слоты/остатки",
    stepIds: ["clients", "work-slots", "stock-receipts"],
    inColdStartFlow: true
  },
  {
    id: "later-settings",
    title: "Позже — в настройках",
    subtitle: "Бонусы, скидки, сотрудники (не Excel-импорт здесь)",
    stepIds: ["staff", "bonus-rules", "discount-rules", "bonus-stack"],
    inColdStartFlow: false
  }
];

export function getStepById(id: string): InitialSetupStep | undefined {
  return [...INITIAL_SETUP_STEPS, ...INITIAL_SETUP_SETTINGS_ONLY].find((s) => s.id === id);
}

export function stepsForGroup(groupId: string): InitialSetupStep[] {
  const group = INITIAL_SETUP_GROUPS.find((g) => g.id === groupId);
  if (!group) return [];
  return group.stepIds
    .map((id) => getStepById(id))
    .filter((s): s is InitialSetupStep => s != null)
    .sort((a, b) => a.order - b.order);
}

export function dependencyLabels(step: InitialSetupStep): string[] {
  return step.dependsOn
    .map((id) => getStepById(id)?.title)
    .filter((t): t is string => Boolean(t));
}

export function canStartStep(
  step: InitialSetupStep,
  doneIds: ReadonlySet<string>
): { ok: boolean; missing: string[] } {
  const missing = step.dependsOn.filter((id) => !doneIds.has(id));
  return { ok: missing.length === 0, missing };
}
