import { CONTACT_SLOTS } from "./clients.helpers";


/** Agent / ekspeditor ustunlari: «Агент 1», «Агент 1 день», «Экспедитор 1» … */
export function clientImportAgentSlotKeyNames(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= CONTACT_SLOTS; i++) {
    keys.push(`import_agent_${i}`, `import_agent_${i}_days`, `import_expeditor_${i}`);
  }
  return keys;
}

/** Shablon va import uchun ruxsat etilgan ustun kalitlari (1-varaq, 1-qator sarlavha). */
export const CLIENT_IMPORT_COLUMN_KEYS = [
  "client_db_id",
  "name",
  "legal_name",
  "phone",
  "address",
  "client_code",
  "client_pinfl",
  "category_name",
  "category_code",
  "category",
  "client_type_name",
  "client_type_code",
  "credit_limit",
  "is_active",
  "responsible_person",
  "landmark",
  "inn",
  "pdl",
  "logistics_service",
  "license_until",
  "working_hours",
  "region",
  "district",
  "city",
  "city_code",
  "neighborhood",
  "zone",
  "street",
  "house_number",
  "apartment",
  "gps_text",
  "latitude",
  "longitude",
  "notes",
  "client_format_name",
  "client_format_code",
  "client_format",
  "sales_channel_name",
  "sales_channel_code",
  "sales_channel",
  "product_category_ref",
  "contact1_firstName",
  "contact1_lastName",
  "contact1_phone",
  "contact2_firstName",
  "contact2_lastName",
  "contact2_phone",
  ...clientImportAgentSlotKeyNames()
] as const;

const HEADER_ALIASES: Record<string, string> = {
  nom: "name",
  nomi: "name",
  mijoz: "name",
  mijoz_nomi: "name",
  telefon: "phone",
  tel: "phone",
  manzil: "address",
  kategoriya: "category_name",
  kredit: "credit_limit",
  kredit_limiti: "credit_limit",
  faol: "is_active",
  masul: "responsible_person",
  masul_shaxs: "responsible_person",
  orientir: "landmark",
  stir: "inn",
  logistika: "logistics_service",
  litsenziya_muddati: "license_until",
  ish_vaqti: "working_hours",
  viloyat: "region",
  tuman: "district",
  shahar: "city",
  gorod: "city",
  город: "city",
  city: "city",
  mahalla: "neighborhood",
  kocha: "street",
  uy: "house_number",
  xonadon: "apartment",
  gps: "gps_text",
  izoh: "notes",
  format: "client_format_name",
  legal_name: "legal_name",
  yuridik_nomi: "legal_name",
  // Ruscha sarlavhalar (Excel / 1C / CRM eksport)
  имя: "name",
  название: "name",
  наименование: "name",
  наименование_полное: "name",
  наименование_клиента: "name",
  наименование_контрагента: "name",
  контрагент: "name",
  организация: "name",
  покупатель: "name",
  клиент: "name",
  фио: "name",
  телефон: "phone",
  адрес: "address",
  категория: "category_name",
  категория_клиента: "category_name",
  категория_клиента_код: "category_code",
  кредит: "credit_limit",
  кредитный_лимит: "credit_limit",
  активен: "is_active",
  активный: "is_active",
  ответственный: "responsible_person",
  ориентир: "landmark",
  инн: "inn",
  юридическое_название: "legal_name",
  юр_название: "legal_name",
  полное_наименование: "legal_name",
  регион: "region",
  область: "region",
  район: "district",
  зона: "zone",
  город_туман: "city",
  тип_клиента_код: "client_type_code",
  тип_клиента: "client_type_name",
  код_типа_клиента: "client_type_code",
  формат_код: "client_format_code",
  формат_клиента: "client_format_name",
  торговый_канал: "sales_channel_name",
  торговый_канал_код: "sales_channel_code",
  канал_продаж: "sales_channel_name",
  канал_продаж_код: "sales_channel_code",
  savdo_kanali: "sales_channel_name",
  sales_channel: "sales_channel_name",
  улица: "street",
  дом: "house_number",
  квартира: "apartment",
  примечание: "notes",
  комментарий: "notes",
  контактное_лицо: "responsible_person",
  контакт: "responsible_person",
  ид_клиента: "client_code",
  id_клиента: "client_code",
  /** CRM ichki qator ID (Lalaku «Обновление клиентов») */
  ид: "client_db_id",
  код_клиента: "client_code",
  клиент_код: "client_code",
  код: "client_code",
  пинфл: "client_pinfl",
  широта: "latitude",
  долгота: "longitude",
  город_код: "city_code",
  категория_продукции: "product_category_ref",
  категория_товара: "product_category_ref"
};

export const VALID_IMPORT_KEYS = new Set<string>(CLIENT_IMPORT_COLUMN_KEYS);

export function normalizeHeaderLabel(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\u00a0/g, " ")
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s*[/\\]+\s*/g, "_")
    .replace(/\s+/g, "_")
    .replace(/[_-]{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/[''`«»]/g, "");
}

export function parseImportSlotFromHeader(n: string, stem: "агент" | "экспедитор"): number | null {
  const m = new RegExp(`^${stem}_?(\\d+)$`).exec(n);
  if (m) {
    const slot = Number.parseInt(m[1], 10);
    if (Number.isFinite(slot) && slot >= 1 && slot <= CONTACT_SLOTS) return slot;
  }
  /** «Эксп. 2» → `эксп._2`, «Эксп_2» → `эксп_2`, «Эксп2» → `эксп2` */
  if (stem === "экспедитор") {
    const mShort =
      /^эксп(?:[._]+|\s*)(\d+)$/.exec(n) ||
      /^эксп(\d+)$/.exec(n);
    if (mShort) {
      const slot = Number.parseInt(mShort[1], 10);
      if (Number.isFinite(slot) && slot >= 1 && slot <= CONTACT_SLOTS) return slot;
    }
  }
  return null;
}

export function parseImportAgentDaysSlotFromHeader(n: string): number | null {
  const m1 = /^агент_?(\d+)_?(день|дни|день_посещения|дни_посещения)$/.exec(n);
  if (m1) {
    const slot = Number.parseInt(m1[1], 10);
    if (Number.isFinite(slot) && slot >= 1 && slot <= CONTACT_SLOTS) return slot;
  }
  /** «День 2», «День2», «Дни 3» — «Агент N день» prefiksisiz eksportlar. */
  const mDay = /^(день|дни)_?(\d+)$/.exec(n);
  if (mDay) {
    const slot = Number.parseInt(mDay[2], 10);
    if (Number.isFinite(slot) && slot >= 1 && slot <= CONTACT_SLOTS) return slot;
  }
  const mVisit = /^(день|дни)_посещения_?(\d+)$/.exec(n);
  if (mVisit) {
    const slot = Number.parseInt(mVisit[2], 10);
    if (Number.isFinite(slot) && slot >= 1 && slot <= CONTACT_SLOTS) return slot;
  }
  if (n === "день" || n === "дни" || n === "день_посещения" || n === "дни_посещения") return 1;
  return null;
}

export function headerToClientImportKey(h: string): string | null {
  const n = normalizeHeaderLabel(h);
  if (HEADER_ALIASES[n]) {
    const k = HEADER_ALIASES[n];
    if (VALID_IMPORT_KEYS.has(k)) return k;
  }
  if (VALID_IMPORT_KEYS.has(n)) return n;
  return null;
}

/** Lalaku: «Агент N», «Агент N день», «Экспедитор N» + standart sarlavhalar. */
export function excelHeaderToImportKey(label: string): string | null {
  const direct = headerToClientImportKey(label);
  if (direct) return direct;
  const n = normalizeHeaderLabel(label);
  const agentSlot = parseImportSlotFromHeader(n, "агент");
  if (agentSlot != null) return `import_agent_${agentSlot}`;
  const daySlot = parseImportAgentDaysSlotFromHeader(n);
  if (daySlot != null) return `import_agent_${daySlot}_days`;
  const expeditorSlot = parseImportSlotFromHeader(n, "экспедитор");
  if (expeditorSlot != null) return `import_expeditor_${expeditorSlot}`;
  return null;
}

