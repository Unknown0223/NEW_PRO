/** Boshlang‘ich sozlash umumiy Excel shabloni — varaq nomlari `sheetName` bilan bir xil bo‘lishi kerak. */

export const PRODUCT_CATALOG_HEADERS = [
  "Название *",
  "Код",
  "Категория *",
  "Единица измерения (название) *",
  "Группа (код)",
  "Сегмент (код)",
  "Штрихкод",
  "ТН ВЭД код",
  "Бренд (код)",
  "Сортировка",
  "Вес (кг)",
  "Количество в блоке",
  "Длина (м)",
  "Ширина (м)",
  "Толщина (м)"
] as const;

export const CLIENT_IMPORT_HEADERS = [
  "Наименование",
  "Юридическое название",
  "Адрес",
  "Телефон",
  "Контактное лицо",
  "Ориентир",
  "ИНН",
  "ПИНФЛ",
  "Торговый канал (код)",
  "Категория клиента (код)",
  "Тип клиента (код)",
  "Формат (код)",
  "Город (код)",
  "Широта",
  "Долгота"
] as const;

/** Keng format: Артикул | <тип цены 1> | <тип цены 2> | … */
export const PRICE_IMPORT_HEADERS = [
  "Артикул (SKU)",
  "Наличные",
  "Терминал",
  "Перечисление"
] as const;

export const STOCK_RECEIPT_HEADERS = [
  "№",
  "Склад",
  "Код товара",
  "Категория",
  "Продукт",
  "Цена",
  "Количество прихода",
  "Количество в блоке"
] as const;

export const WORK_SLOT_HEADERS = [
  "Код слота",
  "Название",
  "Код филиала",
  "Тип слота",
  "Активен (да/нет)",
  "Сортировка",
  "Логин агента"
] as const;

export type BundleTemplateSheet = {
  sheetName: string;
  rows: string[][];
};

/** Eski _README olib tashlandi — START varaq builder ichida */
export const BUNDLE_REFERENCE_SHEETS: BundleTemplateSheet[] = [
  {
    sheetName: "company",
    rows: [
      ["Название организации", "Телефон", "Адрес"],
      ["ООО «Пример»", "+998901234567", "г. Ташкент, ул. Примерная, 1"]
    ]
  },
  {
    sheetName: "units",
    rows: [
      ["Название", "Код", "Заголовок", "Сортировка"],
      ["Штука", "SHT", "шт", "1"],
      ["Килограмм", "KG", "кг", "2"],
      ["Литр", "L", "л", "3"]
    ]
  },
  {
    sheetName: "currencies",
    rows: [
      ["Название", "Код", "По умолчанию (1/0)", "Сортировка"],
      ["Узбекский сум", "UZS", "1", "1"],
      ["Доллар США", "USD", "0", "2"]
    ]
  },
  {
    sheetName: "payment-methods",
    rows: [
      ["Название", "Код", "Валюта (код)", "Сортировка"],
      ["Наличные", "CASH", "UZS", "1"],
      ["Терминал", "TERM", "UZS", "2"],
      ["Перечисление", "BANK", "UZS", "3"]
    ]
  },
  {
    sheetName: "price-types",
    rows: [
      ["Название", "Код", "Способ оплаты", "Вид (продажа/закупка)", "Сортировка"],
      ["Наличные", "CASH", "Наличные", "продажа", "1"],
      ["Терминал", "TERM", "Терминал", "продажа", "2"],
      ["Перечисление", "BANK", "Перечисление", "продажа", "3"]
    ]
  },
  {
    sheetName: "trade-directions",
    rows: [
      ["Название", "Код", "Сортировка", "Комментарий"],
      ["Традиционная торговля", "TT", "1", ""],
      ["HoReCa", "HORECA", "2", ""]
    ]
  },
  {
    sheetName: "sales-channels",
    rows: [
      ["Название", "Код", "Сортировка", "Комментарий"],
      ["Розница", "ROZN", "1", ""],
      ["Опт", "OPT", "2", ""]
    ]
  },
  {
    sheetName: "branches",
    rows: [
      ["Название", "Код", "Сортировка"],
      ["Головной офис", "HQ", "1"],
      ["Филиал 1", "F1", "2"]
    ]
  },
  {
    sheetName: "territory",
    rows: [
      ["Город", "Код города", "Название региона", "Зона"],
      ["Андижан", "AD_SHAXAR", "Андижанская область", "Фергана"],
      ["Бектемир", "TSH_BEKTEMIR", "г. Ташкент", "Ташкент"],
      ["Ангрен", "TV_ANGREN", "Ташкентская область", "Ташобл"]
    ]
  },
  {
    sheetName: "warehouses",
    rows: [
      ["Название", "Код", "Адрес"],
      ["Основной склад", "WH-01", "г. Ташкент"],
      ["Склад 2", "WH-02", ""]
    ]
  },
  {
    sheetName: "product-categories",
    rows: [
      ["Название", "Код", "Родитель"],
      ["Напитки", "DRINK", ""],
      ["Соки", "JUICE", "Напитки"]
    ]
  },
  {
    sheetName: "client-formats",
    rows: [
      ["Название", "Код", "Сортировка", "Комментарий"],
      ["Супермаркет", "SUPER", "1", ""],
      ["Киоск", "KIOSK", "2", ""]
    ]
  },
  {
    sheetName: "client-types",
    rows: [
      ["Название", "Код", "Сортировка", "Комментарий"],
      ["Розничный", "ROZN", "1", ""],
      ["Оптовый", "OPT", "2", ""]
    ]
  },
  {
    sheetName: "client-categories",
    rows: [
      ["Название", "Код", "Сортировка", "Комментарий"],
      ["Категория A", "A", "1", ""],
      ["Категория B", "B", "2", ""]
    ]
  }
];

export const BUNDLE_IMPORT_SHEETS_FALLBACK: BundleTemplateSheet[] = [
  {
    sheetName: "products-catalog",
    rows: [
      [...PRODUCT_CATALOG_HEADERS],
      [
        "Пример товара",
        "SKU-001",
        "Напитки",
        "dona",
        "",
        "",
        "8600000000001",
        "",
        "",
        "1",
        "0.5",
        "1",
        "",
        "",
        ""
      ]
    ]
  },
  {
    sheetName: "product-prices",
    rows: [
      [...PRICE_IMPORT_HEADERS],
      ["SKU-001", "15000", "15000", "15000"],
      ["SKU-002", "12000", "12500", "12000"]
    ]
  },
  {
    sheetName: "clients",
    rows: [
      [...CLIENT_IMPORT_HEADERS],
      [
        "Магазин «Пример»",
        "ООО Пример",
        "г. Ташкент, ул. Примерная, 10",
        "+998901112233",
        "Иванов Иван",
        "Рядом с рынком",
        "",
        "",
        "ROZN",
        "A",
        "ROZN",
        "SUPER",
        "TASH",
        "41.2995",
        "69.2401"
      ]
    ]
  },
  {
    sheetName: "work-slots",
    rows: [
      [...WORK_SLOT_HEADERS],
      ["SLOT-01", "Зона 1", "HQ", "агент", "да", "1", ""]
    ]
  },
  {
    sheetName: "stock-receipts",
    rows: [
      [...STOCK_RECEIPT_HEADERS],
      ["1", "Основной склад", "SKU-001", "Напитки", "Пример товара", "12000", "100", "1"]
    ]
  }
];

/** Serverdan yuklab, bundle varaq nomiga qo‘yiladi */
export const SERVER_IMPORT_TEMPLATE_PATHS: Record<
  string,
  { path: string; filename: string }
> = {
  "products-catalog": {
    path: "/products/import-template",
    filename: "import-products-template.xlsx"
  },
  clients: {
    path: "/clients/import/template",
    filename: "clients-import-template.xlsx"
  },
  "stock-receipts": {
    path: "/stock/import-template?kind=postupleniya2",
    filename: "stock-import-template.xlsx"
  }
};
