/**
 * AI Assistant — enhanced NLU (sinonimlar, typo-qo'lqollik, davr, slotlar).
 *
 * `ai.intent.ts` dan foydalanadi: skorga asoslangan intent aniqlovchini
 * siynli sinonimlar va fuzzy-match bilan kengaytiradi. LLM ixtiyoriy.
 */
import { has, normalizeText, parseAmount } from "./ai.text";
import { parsePeriod } from "./ai.dates";
import type { AiSlots } from "./ai.types";

/** So'zlar orasidagi maksimal harf farqi (typo uchun). */
const TYPO_THRESHOLD = 2;

/** Uz/ru sinonimlar — kalit so'z → [uz_variantlar, ru_variantlar] */
const SYNONYMS: Record<string, string[]> = {
  savdo: ["sotuv", "tushum", "oborot", "выручка", "продаж", "продажи", "savdo"],
  qarz: ["qarzdor", "nasiya", "debt", "долг", "задолженность", "debitorsk", "qarz"],
  ombor: ["sklad", "zapas", "ostatok", "склад", "остаток", "qoldiq", "ombor"],
  mijoz: ["klient", "kontragent", "клиент", "покупатель", "mijozlar"],
  buyurtma: ["zakaz", "заказ", "order", "buyurtmalar"],
  tolov: ["payment", "to'lov", "tulov", "платеж", "оплата", "to'lovlar"],
  xodim: ["sotuvchi", "ishchi", "сотрудник", "agent", "xodimlar"],
  narx: ["price", "tsena", "цена", "narxlar"],
  vozvrat: ["qaytim", "return", "возврат", "vozvrati"],
  hisoblash: [" hisob", "itog", "итог", "yakun", "hisob-kitob"],
  ish_haqi: ["maosh", "salary", "зарплата", "payroll", "avans"],
  filial: ["branch", "filial", " филиал", "branch"],
  konsignatsiya: ["consignment", "консигнация", "qarz", "konsignatsiya"],
  tabel: ["sheet", "табель", "ish kunlari", "tabel"],
  kpi: ["plan", "plan-rasto", "kpi", "кпи", "rasto"],
  dizayn: ["draft", " tasvirlash"]
};

/** Noto'g'ri yozilishi mumkin bo'lgan kalit so'zlar va ularning to'g'ri variantlar. */
const TYPO_MAP: Record<string, string[]> = {
  savdo: ["savdo", "sotuv", "sadv", "savdoo"],
  qarz: ["qarz", "qarzdor", "qarzdorlar", "qarzlar"],
  ombor: ["ombor", "ombord", "omborq", "qoldiq"],
  mijoz: ["mijoz", "mijozlar", "mijozga", "klient"],
  buyurtma: ["buyurtma", "buyurtmalar", "buyurtmasi"],
  tolov: ["tolov", "to'lov", "tolovlar", "to'lovlar"],
  xodim: ["xodim", "xodimlar", "xodimga"],
  narx: ["narx", "narxl", "narxlar", "tsena"]
};

/**
 * Matnda typo bo'lgan kalit so'zni topib, to'g'ri variantga qaytaradi.
 * Agar hech qaysi mos kelsa — `undefined`.
 */
function fuzzyMatchWord(text: string, correct: string, variants: string[]): string | undefined {
  const words = text.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    for (const variant of [correct, ...variants]) {
      if (levenshtein(word, variant) <= TYPO_THRESHOLD) return variant;
    }
  }
  return undefined;
}

/** Levenshtein masofasi (oddiy, tezkor). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // deletion
        dp[i]![j - 1]! + 1, // insertion
        dp[i - 1]![j - 1]! + cost // substitution
      );
    }
  }
  return dp[m]![n]!;
}

/**
 * Matnda kalit so'z bormi? Sinonim + typo-qo'llqollik bilan.
 */
export function hasKeyword(text: string, key: string): boolean {
  const variants = SYNONYMS[key];
  if (!variants) return has(text, key);
  return variants.some((v) => text.includes(v));
}

/**
 * Intent bo'yicha kalit so'zlar topiladi (sinonim + typo).
 * Qaytaradi: topilgan variantlar ro'yxati.
 */
export function matchKeywords(text: string, keywords: string[]): string[] {
  const found: string[] = [];
  for (const kw of keywords) {
    const parts = kw.split(/\s+/);
    if (parts.length === 1) {
      if (hasKeyword(text, kw)) found.push(kw);
      else {
        const f = fuzzyMatchWord(text, kw, []);
        if (f) found.push(f);
      }
    } else if (text.includes(kw)) {
      found.push(kw);
    }
  }
  return found;
}

/**
 * Davrni ajratish — `ai.dates` dan foydalanadi, lekin qo'shimcha kalit so'zlar bilan.
 */
export function extractPeriod(text: string, today: string): { from?: string; to?: string; label?: string } | undefined {
  const p = parsePeriod(text, today);
  if (!p) return undefined;
  return { from: p.from, to: p.to, label: `${p.from} — ${p.to}` };
}

/**
 * Mahsulot SKU ni ajratish: `SKU-001`, `PRD-123` kabi.
 */
export function extractSku(text: string): string | undefined {
  const m = text.match(/\b([A-Z]{1,6}[-_]?\d{2,10})\b/i);
  return m?.[1]?.toUpperCase();
}

/**
 * Summa ajratish: «150000», «1.5 mln», «500 ming».
 */
export function extractAmount(text: string): number | undefined {
  return parseAmount(text);
}

/**
 * Mijoz/agent/SKU qidiruv so'zi ajratish (tirnoq ichidan yoki «nom:» dan keyin).
 */
export function extractSearchTerm(text: string): string | undefined {
  const quoted = text.match(/[«"“']([^»"’]{2,80})[»"’]/);
  if (quoted?.[1]) return quoted[1].trim();
  const afterColon = text.match(/(?:nom|ismi|fio|sku|nomi|deb|назв)\s*[:：]\s*([^\s,;.]{2,60})/i);
  if (afterColon?.[1]) return afterColon[1].trim();
  return undefined;
}

/**
 * Rol turini ajratish: agent, operator, ekspeditor, supervisor, skladchik, collector, auditor.
 */
export function extractStaffKind(text: string): string | undefined {
  const kinds: Record<string, string[]> = {
    agent: ["agent", "агент", "sotuvchi"],
    operator: ["operator", "оператор"],
    expeditor: ["ekspeditor", "экспедитор"],
    supervisor: ["supervisor", "супервайзер"],
    skladchik: ["skladchik", "кладовщик", "omborchi"],
    collector: ["collector", "inkassator", "инкассатор"],
    auditor: ["auditor", "аудитор"]
  };
  const q = normalizeText(text);
  for (const [kind, words] of Object.entries(kinds)) {
    if (words.some((w) => q.includes(w.toLowerCase()))) return kind;
  }
  return undefined;
}

/**
 * Holatni ajratish: faol/nofaol, ochiq/yopiq, kutilmoqda/bajarildi.
 */
export function extractActive(text: string): boolean | undefined {
  const q = normalizeText(text);
  if (has(q, "faol", "aktiv", "active", "ochiq", "open")) return true;
  if (has(q, "nofaol", "deaktiv", "inactive", "yopiq", "closed", "blok")) return false;
  return undefined;
}

/**
 * Holat (status) ajratish: kutilmoqda, tasdiqlandi, yuborildi, bekor qilindi.
 */
export function extractStatus(text: string): string | undefined {
  const q = normalizeText(text);
  const statuses: Record<string, string[]> = {
    pending: ["kutilmoqda", "pending", "yangi", "new"],
    confirmed: ["tasdiqlandi", "confirmed", "approved"],
    shipped: ["yuborildi", "shipped", "yetkazildi"],
    cancelled: ["bekor", "cancelled", "canceled", "rejected"],
    completed: ["bajarildi", "completed", "done", "ready"]
  };
  for (const [status, words] of Object.entries(statuses)) {
    if (words.some((w) => q.includes(w))) return status;
  }
  return undefined;
}

/**
 * Eksport formatsini aniqlash: xlsx / csv.
 */
export function extractExportFormat(text: string): "xlsx" | "csv" | undefined {
  const q = normalizeText(text);
  if (has(q, "csv", "exsel")) return "csv";
  if (has(q, "xlsx", "excel", "fayl", "yuklab")) return "xlsx";
  return undefined;
}
