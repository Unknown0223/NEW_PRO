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
export const DOCUMENT_EDIT_PERIOD_LOCKED_MESSAGE = "Davr yopilgan. Admin ochishi kerak.";

const DEFAULT_DAYS: Record<DocumentEditLockSection, number> = {
  payments: 1,
  orders: 3,
  returns: 2,
  stock: 1,
  expenses: 7,
  opening_balances: 30
};

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

/** Hujjat sanasi bo‘yicha oyna ochiqmi (grant/admin hisobga olinmaydi). */
export function isDocumentDateWithinLockWindow(
  documentDate: Date,
  days: number,
  now: Date = new Date()
): boolean {
  const age = utcCalendarDaysSince(documentDate, now);
  if (age < 0) return true;
  return age < days;
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
