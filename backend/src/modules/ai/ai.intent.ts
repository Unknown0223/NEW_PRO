/**
 * AI Assistant — intent va slot ajratish (rules-based, pure).
 *
 * LLM ixtiyoriy: bu qatlam har doim ishlaydi va LLM javobini tekshirish uchun
 * "fallback" bo‘lib xizmat qiladi.
 */
import { parsePeriod, tashkentToday } from "./ai.dates";
import { escapeRegExp, extractQuoted, has, normalizeText, parseAmount, truncate } from "./ai.text";
import type { AiIntentName, AiKind, AiSlots } from "./ai.types";

type IntentSpec = { name: AiIntentName; kind: AiKind; keywords: string[] };

const READ_INTENTS: IntentSpec[] = [
  {
    name: "overview",
    kind: "read",
    keywords: [
      "umumiy holat", "umumiy ma'lumot", "hamma narsa", "hammasi", "barchasi", "boshlang'ich holat",
      "сводка", "обзор", "общая картина", "всё", "все данные", "что происходит"
    ]
  },
  {
    name: "dashboard.stats",
    kind: "read",
    keywords: ["dashboard", "bugungi holat", "asosiy ko'rsatkich", "kpi", "статистика", "показатели"]
  },
  { name: "sales.by_agent", kind: "read", keywords: ["agent savdo", "agentlar savdo", "agent bo'yicha", "agentlar bo'yicha", "по агентам", "агенты продажи"] },
  { name: "sales.by_product", kind: "read", keywords: ["top mahsulot", "mahsulot savdosi", "mahsulotlar savdosi", "tovar savdosi", "продажи товаров", "топ товар", "по товарам"] },
  { name: "sales.by_client", kind: "read", keywords: ["mijoz savdosi", "mijozlar savdosi", "mijoz bo'yicha", "по клиентам", "продажи клиентов"] },
  { name: "sales.trend", kind: "read", keywords: ["dinamika", "trend", "kunlik savdo", "grafik", "динамика", "по дням", "график"] },
  { name: "sales.summary", kind: "read", keywords: ["savdo", "продаж", "оборот", "выручка", "tushum", "sotuv", "revenue"] },
  { name: "returns.list", kind: "read", keywords: ["vozvrat", "qaytim", "возврат", "возвраты"] },
  { name: "orders.detail", kind: "read", keywords: ["buyurtma tafsilot", "buyurtma haqida", "заказ деталь", "buyurtma raqami"] },
  { name: "returns.detail", kind: "read", keywords: ["qaytirish tafsilot", "vozvrat tafsilot", "возврат деталь"] },
  { name: "consignment.list", kind: "read", keywords: ["konsignatsiya", "консигнация", "konsignatsiya qarz", "qarz omborda"] },
  { name: "branch.stats", kind: "read", keywords: ["filial statistika", "filial bo'yicha", "филиал статистика", "branch"] },
  { name: "tabel.list", kind: "read", keywords: ["tabel", "табель", "ish kunlari", "ish kun"] },
  { name: "kpi.plan", kind: "read", keywords: ["kpi", "plan-rasto", "plan vs", "кпи", "planni bajarish"] },
  { name: "price.matrix", kind: "read", keywords: ["narx matritsa", "narxlar ro'yxati", "цена матрица", "price matrix"] },
  { name: "inventory.turnover", kind: "read", keywords: ["ombor aylanishi", "sotuv aylanishi", "склад оборот", "turnover"] },
  { name: "price.as-of", kind: "read", keywords: ["narx bo'yicha sana", "narx as_of", "narx sana bo'yicha", "цена на дату", "price as of"] },
  { name: "finance.receivables", kind: "read", keywords: ["qarz", "qarzdor", "долг", "должник", "дебитор", "задолженность", "receivable", "nasiya"] },
  { name: "finance.cashflow", kind: "read", keywords: ["pul oqimi", "kassa oqimi", "cash flow", "движение денег", "денежный поток"] },
  { name: "finance.pnl", kind: "read", keywords: ["foyda", "zarar", "прибыль", "убыток", "pnl", "rentabellik", "рентабельность"] },
  { name: "finance.expenses_summary", kind: "read", keywords: ["rasxod jami", "xarajat jami", "расходы итог", "сумма расходов"] },
  { name: "finance.expenses", kind: "read", keywords: ["rasxod", "xarajat", "расход", "затрат", "expense"] },
  { name: "finance.cash_desks", kind: "read", keywords: ["kassa", "касса", "кассы", "cash desk", "naqd qoldiq"] },
  { name: "orders.list", kind: "read", keywords: ["buyurtma", "заказ", "заказы", "order"] },
  { name: "payments.list", kind: "read", keywords: ["to'lov", "tulov", "платеж", "платёж", "оплата", "payment"] },
  { name: "clients.list", kind: "read", keywords: ["mijoz", "клиент", "клиенты", "client", "kontragent"] },
  { name: "products.list", kind: "read", keywords: ["mahsulot", "tovar", "товар", "nomenklatura", "product", "skular"] },
  { name: "stock.balances", kind: "read", keywords: ["ombor", "qoldiq", "склад", "остаток", "остатки", "stock", "zapas"] },
  { name: "staff.list", kind: "read", keywords: ["xodim", "сотрудник", "персонал", "foydalanuvchi", "пользовател", "staff", "ishchi"] },
  { name: "tasks.list", kind: "read", keywords: ["vazifa", "topshiriq", "задача", "задачи", "task"] },
  { name: "payroll.list", kind: "read", keywords: ["ish haqi", "maosh", "зарплата", "payroll", "avans", "аванс"] },
  {
    name: "help.capabilities",
    kind: "read",
    keywords: ["nima qila olasan", "yordam", "help", "imkoniyat", "что ты умеешь", "помощь", "qanday savol"]
  }
];

const WRITE_INTENTS: IntentSpec[] = [
  {
    name: "write.set_price",
    kind: "write",
    keywords: [
      "narxini", "narxni", "narx o'zgartir", "narxni o'zgartir", "narx belgila", "yangi narx",
      "цену", "цену измени", "изменить цену", "установить цену", "прайс"
    ]
  },
  {
    name: "write.create_employee",
    kind: "write",
    keywords: [
      "xodim qo'sh", "xodim qo'shish", "agent qo'sh", "agent qo'shish", "yangi agent", "yangi xodim",
      "operators qo'sh", "operator qo'sh", "ekspeditor qo'sh", "supervisor qo'sh",
      "добав сотрудник", "добавить агента", "новый агент", "создать сотрудника", "добавить сотрудника"
    ]
  },
  {
    name: "write.update_employee",
    kind: "write",
    keywords: [
      "xodimni o'zgartir", "agentni o'zgartir", "xodimni tahrirla", "agentni tahrirla",
      "agentni blokla", "xodimni blokla", "faolsizlantir", "faollashtir", "aktivlashtir",
      "изменить сотрудника", "заблокировать агента", "деактивировать"
    ]
  },
  {
    name: "write.create_client",
    kind: "write",
    keywords: [
      "mijoz qo'sh", "mijoz qo'shish", "yangi mijoz", "klient qo'sh", "mijoz yarat",
      "добавить клиента", "новый клиент", "создать клиента"
    ]
  },
  {
    name: "write.update_client",
    kind: "write",
    keywords: ["mijozni o'zgartir", "mijozni tahrirla", "klientni o'zgartir", "изменить клиента", "клиента измени"]
  },
  {
    name: "write.create_product",
    kind: "write",
    keywords: [
      "mahsulot qo'sh", "mahsulot qo'shish", "yangi mahsulot", "tovar qo'sh",
      "добавить товар", "новый товар", "создать товар"
    ]
  },
  {
    name: "write.update_settings",
    kind: "write",
    keywords: [
      "sozlamani o'zgartir", "sozlamalarni o'zgartir", "kompaniya nomini", "sozlamani yangila",
      "изменить настройки", "настройки компании", "обновить настройки"
    ]
  },
  {
    name: "write.create_task",
    kind: "write",
    keywords: [
      "vazifa ber", "vazifa qo'sh", "topshiriq ber", "topshiriq qo'sh", "vazifa yarat",
      "поставить задачу", "создать задачу", "добавить задачу"
    ]
  },
  {
    name: "write.update_product",
    kind: "write",
    keywords: [
      "mahsulotni o'zgartir", "mahsulotni tahrirla", "tovarni o'zgartir", "mahsulot yangila",
      "изменить товар", "обновить товар", "tovarni yangila"
    ]
  },
  {
    name: "write.order_status",
    kind: "write",
    keywords: [
      "buyurtma holatini", "buyurtmani o'zgartir", "zakaz status", "заказ статус", "изменить статус заказа",
      "buyurtma tasdiq", "buyurtma bekor", "order status", "order confirm"
    ]
  }
];

const ALL_INTENTS: IntentSpec[] = [...WRITE_INTENTS, ...READ_INTENTS];

export const WRITE_INTENT_NAMES = WRITE_INTENTS.map((item) => item.name);

export const ALL_INTENT_NAMES: readonly string[] = ALL_INTENTS.map((item) => item.name);

export function isKnownIntent(intent: string): boolean {
  return ALL_INTENTS.some((item) => item.name === intent);
}

export function isWriteIntent(intent: string): boolean {
  return WRITE_INTENTS.some((item) => item.name === intent);
}

function scoreIntent(q: string, spec: IntentSpec): number {
  let score = 0;
  for (const keyword of spec.keywords) {
    if (q.includes(keyword)) {
      const words = keyword.split(/\s+/).length;
      score += 2 + words * 2;
    }
  }
  return score;
}

export type IntentMatch = { intent: AiIntentName; score: number };

/** Eng yuqori skorli intent; hech narsa topilmasa — `help.capabilities`. */
export function detectIntent(question: string): IntentMatch {
  const q = normalizeText(question);
  let best: IntentMatch = { intent: "help.capabilities", score: 0 };
  for (const spec of ALL_INTENTS) {
    const score = scoreIntent(q, spec);
    if (score > best.score) best = { intent: spec.name, score };
  }
  return best;
}

const STAFF_KINDS: Array<{ kind: string; words: string[] }> = [
  { kind: "expeditor", words: ["ekspeditor", "экспедитор", "expeditor"] },
  { kind: "supervisor", words: ["supervisor", "супервайзер", "supervayzer"] },
  { kind: "skladchik", words: ["skladchik", "omborchi", "кладовщик", "складчик"] },
  { kind: "collector", words: ["inkassator", "collector", "инкассатор"] },
  { kind: "auditor", words: ["auditor", "аудитор"] },
  { kind: "operator", words: ["operator", "оператор"] },
  { kind: "agent", words: ["agent", "агент"] }
];

const PRICE_TYPES: Array<{ value: string; words: string[] }> = [
  { value: "retail", words: ["chakana", "розниц", "retail"] },
  { value: "wholesale", words: ["ulgurji", "оптов", "wholesale"] },
  { value: "optom", words: ["optom", "оптом"] },
  { value: "cost", words: ["tannarx", "себестоим", "cost"] }
];

function extractSearch(q: string): string | undefined {
  const quoted = extractQuoted(q);
  if (quoted) return quoted;
  const named = q.match(/(?:nomli|ismli|deb nomlangan|названием|имени)\s+([\p{L}\p{N} '-]{2,60})/u);
  if (named?.[1]) return named[1].trim();
  const sku = q.match(/\b([A-Za-z]{2,6}-?\d{2,10})\b/);
  if (sku?.[1] && /\d/.test(sku[1])) return sku[1];
  const phone = q.match(/(\+?\d{9,13})/);
  if (phone?.[1]) return phone[1];
  const after = q.match(/(?:uchun|для)\s+([\p{L}\p{N} '-]{2,40})/u);
  if (after?.[1]) return after[1].trim();
  return undefined;
}

function extractLimit(q: string): number | undefined {
  const top = q.match(/\b(?:top|eng|первые|первых)\s*(\d{1,3})\b/);
  const tail = q.match(/\b(\d{1,3})\s*(?:ta|та)\b/);
  const value = Number(top?.[1] ?? tail?.[1] ?? 0);
  if (!value) return undefined;
  return Math.min(50, Math.max(1, value));
}

function extractLogin(q: string): string | undefined {
  const m = q.match(/\b(?:login|логин)\s*[:=]?\s*([\p{L}\p{N}._-]{3,32})/u);
  return m?.[1];
}

function extractPassword(q: string): string | undefined {
  const m = q.match(/\b(?:parol|пароль|password)\s*[:=]?\s*(\S{4,64})/u);
  return m?.[1];
}

function extractName(original: string): string | undefined {
  const low = normalizeText(original);
  const explicit = low.match(/\b(?:ismi|fio|ном|ism|fish)\s*[:=]?\s*([\p{L} '-]{2,60})/u);
  if (explicit?.[1]) return explicit[1].trim();
  // «Yangi agent qo'sh: Aziz Karimov, ...» — bosh harfli ism
  const capital = original.match(/[:\-—]\s*([A-ZА-ЯЁ][\p{L}'-]+(?:\s+[A-ZА-ЯЁ][\p{L}'-]+)?)/u);
  return capital?.[1]?.trim();
}

function extractPhone(q: string): string | undefined {
  const m = q.match(/(\+?\d{9,13})/);
  return m?.[1];
}

function extractNumberAfter(q: string, prefixes: string[]): number | undefined {
  for (const prefix of prefixes) {
    const m = q.match(new RegExp(`\\b${escapeRegExp(prefix)}\\s*[#№]?\\s*(\\d{1,10})\\b`, "i"));
    if (m?.[1]) return Number(m[1]);
  }
  return undefined;
}

function extractOrderId(q: string): number | undefined {
  return extractNumberAfter(q, ["buyurtma", "order", "заказ", "raqami", "raqam"]);
}

function extractReturnId(q: string): number | undefined {
  return extractNumberAfter(q, ["qaytarish", "vozvrat", "return", "возврат"]);
}

function extractProductId(q: string): number | undefined {
  return extractNumberAfter(q, ["mahsulot", "tovar", "product", "sku", "tovar_id"]);
}

function extractBranchId(q: string): number | undefined {
  return extractNumberAfter(q, ["filial", "branch", "филиал"]);
}

function extractYearMonth(q: string, today: string): { year?: number; month?: number } {
  const m = q.match(/(\d{4})[-/](\d{1,2})/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  if (has(q, "shu oy", "bu oy", "joriy oy")) {
    const [y, mo] = today.slice(0, 7).split("-").map(Number);
    return { year: y, month: mo };
  }
  return {};
}

/** Savoldan barcha slotlarni ajratadi. */
export function extractSlots(question: string, today: string = tashkentToday()): AiSlots {
  const q = normalizeText(question);
  const period = parsePeriod(question, today);
  const staffKind = STAFF_KINDS.find((item) => item.words.some((w) => q.includes(w)))?.kind;
  const priceType = PRICE_TYPES.find((item) => item.words.some((w) => q.includes(w)))?.value;
  const wantExport =
    has(q, "excel", "exsel", "fayl", "csv", "yuklab", "скачат", "скачать", "в excel", "выгруз", "otchot fayl") ||
    /\b(xlsx|csv|pdf)\b/.test(q);

  const slots: AiSlots = {
    raw: q,
    from: period?.from,
    to: period?.to,
    search: extractSearch(question),
    limit: extractLimit(q),
    priceType,
    staffKind,
    login: extractLogin(q),
    password: extractPassword(q),
    phone: extractPhone(q),
    name: extractName(question),
    wantExport,
    exportFormat: /\bcsv\b/.test(q) ? "csv" : wantExport ? "xlsx" : undefined,
    active: has(q, "faolsizlantir", "blokla", "deaktiv", "заблокир") ? false : has(q, "faollashtir", "aktivlashtir") ? true : undefined,
    order_id: extractOrderId(q),
    return_id: extractReturnId(q),
    product_id: extractProductId(q),
    branch_id: extractBranchId(q),
    ...extractYearMonth(q, today)
  };

  if (slots.search) slots.search = truncate(slots.search, 60);
  return slots;
}
