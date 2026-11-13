/** Davr cheklovi: sozlama tipi, normalizatsiya, kun oynasi (sof mantiq). */

export const DOCUMENT_EDIT_LOCK_SECTIONS = [
  "payments",
  "orders",
  "returns",
  "stock",
  "expenses",
  "opening_balances"
] as const;

export type DocumentEditLockSection = (typeof DOCUMENT_EDIT_LOCK_SECTIONS)[number];

export type DocumentEditLockSectionConfig = {
  enabled: boolean;
  days: number;
};

export type DocumentEditLockSettings = {
  enabled: boolean;
  sections: Record<DocumentEditLockSection, DocumentEditLockSectionConfig>;
};

export const DOCUMENT_EDIT_PERIOD_LOCKED = "DOCUMENT_EDIT_PERIOD_LOCKED";
export const DOCUMENT_EDIT_PERIOD_LOCKED_MESSAGE = "Период закрыт. Открыть его может администратор.";

const DEFAULT_DAYS: Record<DocumentEditLockSection, number> = {
  payments: 1,
  orders: 3,
  returns: 2,
  stock: 1,
  expenses: 7,
  opening_balances: 30
};

const SECTION_LABEL_RU: Record<DocumentEditLockSection, string> = {
  payments: "Оплаты",
  orders: "Заказы",
  returns: "Возвраты",
  stock: "Склад",
  expenses: "Расходы",
  opening_balances: "Начальные остатки"
};

function ruDaysWord(n: number): string {
  const abs = Math.abs(Math.trunc(n)) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return "дней";
  if (last === 1) return "день";
  if (last >= 2 && last <= 4) return "дня";
  return "дней";
}

function formatRuDateUtc(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Foydalanuvchiga tushunarli sabab: qaysi bo‘lim, necha kun, qaysi sana yopiq.
 */
export function buildDocumentEditPeriodLockedMessage(input: {
  section: DocumentEditLockSection;
  days: number;
  documentDate: Date | null | undefined;
}): string {
  const sectionLabel = SECTION_LABEL_RU[input.section] ?? input.section;
  const days = Math.max(1, Math.floor(input.days) || 1);
  const window = `±${days} ${ruDaysWord(days)} от текущей даты`;
  const date =
    input.documentDate != null && !Number.isNaN(input.documentDate.getTime())
      ? formatRuDateUtc(input.documentDate)
      : null;

  if (date) {
    return (
      `Дата ${date} выходит за разрешённое окно раздела «${sectionLabel}» (${window}). ` +
      `Поэтому операция запрещена. Временно открыть период может администратор.`
    );
  }
  return (
    `Документ раздела «${sectionLabel}» закрыт ограничением периода (${window}). ` +
    `Временно открыть доступ может администратор.`
  );
}

export function defaultDocumentEditLockSettings(): DocumentEditLockSettings {
  const sections = {} as Record<DocumentEditLockSection, DocumentEditLockSectionConfig>;
  for (const key of DOCUMENT_EDIT_LOCK_SECTIONS) {
    sections[key] = { enabled: true, days: DEFAULT_DAYS[key] };
  }
  return { enabled: false, sections };
}

function asRecord(v: unknown): Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function clampDays(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.min(365, Math.max(1, Math.floor(x)));
}

export function normalizeDocumentEditLockSettings(raw: unknown): DocumentEditLockSettings {
  const base = defaultDocumentEditLockSettings();
  const root = asRecord(raw);
  const sectionsRaw = asRecord(root.sections);
  const sections = { ...base.sections };
  for (const key of DOCUMENT_EDIT_LOCK_SECTIONS) {
    const s = asRecord(sectionsRaw[key]);
    sections[key] = {
      enabled: s.enabled === undefined ? true : Boolean(s.enabled),
      days: s.days === undefined ? DEFAULT_DAYS[key] : clampDays(s.days)
    };
  }
  return {
    enabled: root.enabled === undefined ? false : Boolean(root.enabled),
    sections
  };
}

/** UTC kalendar kunlar farqi (doc → now). 0 = shu kun. */
export function utcCalendarDaysSince(documentDate: Date, now: Date = new Date()): number {
  const a = Date.UTC(documentDate.getUTCFullYear(), documentDate.getUTCMonth(), documentDate.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Hujjat sanasi bo‘yicha oyna ochiqmi (grant/admin hisobga olinmaydi).
 * Oyna simmetrik: o‘tmish va kelajak uchun |kun farqi| < days
 * (masalan days=1 → faqat bugun; days=3 → bugun ±2 kun).
 */
export function isDocumentDateWithinLockWindow(
  documentDate: Date,
  days: number,
  now: Date = new Date()
): boolean {
  const age = utcCalendarDaysSince(documentDate, now);
  return Math.abs(age) < days;
}

export function isDocumentEditLockSection(
  value: string
): value is DocumentEditLockSection {
  return (DOCUMENT_EDIT_LOCK_SECTIONS as readonly string[]).includes(value);
}

/**
 * Sof tekshiruv (DB grantsiz). Natija:
 * - allow: admin / global off / section off / date in window
 * - need_grant: oynadan tashqari — grant tekshirish kerak
 */
export function evaluateDocumentEditLockPure(input: {
  settings: DocumentEditLockSettings;
  section: DocumentEditLockSection;
  documentDate: Date | null | undefined;
  actorRole: string | null | undefined;
  now?: Date;
}): "allow" | "need_grant" {
  if (input.actorRole === "admin") return "allow";
  if (!input.settings.enabled) return "allow";
  const sec = input.settings.sections[input.section];
  if (!sec?.enabled) return "allow";
  if (input.documentDate == null || Number.isNaN(input.documentDate.getTime())) {
    return "need_grant";
  }
  if (isDocumentDateWithinLockWindow(input.documentDate, sec.days, input.now ?? new Date())) {
    return "allow";
  }
  return "need_grant";
}
