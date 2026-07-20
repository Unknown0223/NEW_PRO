/** Excel varaq nomlari — tizim (sozlamalar) tilida, ruscha. `stepId` ichki kalit. */

export const STEP_SHEET_TAB: Record<string, string> = {
  company: "Компания",
  territory: "Территория",
  units: "Единицы",
  currencies: "Валюты",
  "payment-methods": "Способ оплаты",
  "price-types": "Типы цен",
  "trade-directions": "Направление",
  "sales-channels": "Канал продаж",
  branches: "Филиалы",
  warehouses: "Склады",
  "client-formats": "Формат клиента",
  "client-types": "Тип клиента",
  "client-categories": "Категория клиента",
  "product-categories": "Категории продуктов",
  "products-catalog": "Продукты",
  "product-prices": "Цены",
  clients: "Клиенты",
  "work-slots": "Слоты",
  "stock-receipts": "Поступление"
};

export const START_SHEET_TAB = "Инструкция";

export function normSheetTab(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, "-")
    .replace(/ё/g, "е");
}

export function tabLabelForStep(stepId: string): string {
  return STEP_SHEET_TAB[stepId] ?? stepId;
}

export function stepIdFromTabLabel(tab: string): string | undefined {
  const norm = normSheetTab(tab);
  if (norm === normSheetTab(START_SHEET_TAB) || norm === "start" || norm === "инструкция") {
    return undefined;
  }

  const entry = Object.entries(STEP_SHEET_TAB).find(([, label]) => normSheetTab(label) === norm);
  if (entry) return entry[0];

  return undefined;
}

export const STEP_SHEET_HINT_RU: Record<string, string> = {
  company: "Одна строка: организация, телефон, адрес",
  territory: "Город | Код города | Название региона | Зона — каждая строка = город",
  units: "Код обязателен (шт → SHT, кг → KG)",
  currencies: "Для UZS в колонке «По умолчанию» укажите 1",
  "payment-methods": "Код валюты — из листа «Валюты»",
  "price-types": "Способ оплаты — с листа «Способ оплаты»; вид: продажа или закупка",
  "trade-directions": "Направления торговли",
  "sales-channels": "Нужны для импорта клиентов",
  branches: "Код филиала для складов и агентов",
  warehouses: "Название обязательно; код — по желанию",
  "client-formats": "Заполните до импорта клиентов",
  "client-types": "Заполните до импорта клиентов",
  "client-categories": "Заполните до импорта клиентов",
  "product-categories": "Родитель — название существующей категории (можно пусто)",
  "products-catalog": "Название категории должно существовать в справочнике; единица — название (dona, kg, litr…)",
  "product-prices":
    "Широкий формат: Артикул (SKU) | Наличные | Терминал | Перечисление (имя колонки = тип цены)",
  clients: "После справочников и территории",
  "work-slots": "Колонка «Код слота» обязательна",
  "stock-receipts": "Склад + код товара + количество прихода (после складов и продуктов)"
};

export function hintForStep(stepId: string): string {
  return STEP_SHEET_HINT_RU[stepId] ?? "";
}
