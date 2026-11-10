/**
 * Tabel (davomat) sozlamalari — sof mantiq.
 *
 * Bu fayl React'dan mustaqil: faqat hisoblash/tekshirish. Shu sababli
 * `tabel-settings.logic.test.ts` da to'g'ridan-to'g'ri test qilinadi.
 */

export type PunchMethodKey = "photo" | "video" | "kiosk" | "terminal";

export type PunchModesValue = {
  methods?: Partial<Record<PunchMethodKey, boolean>>;
  byRole?: Record<string, Partial<Record<PunchMethodKey, boolean>>>;
};

export type RoleMethodValue = "default" | "on" | "off";

/** Saqlash mumkin bo'lgan tab bo'limlari (locations — alohida panel). */
export type SavableTabelSectionSlug =
  | "lateness-rules"
  | "punch-modes"
  | "punch-video"
  | "face-antifraud"
  | "telegram-attendance"
  | "retention"
  | "dictionaries";

export type TabelSettingsDict = Record<string, any>;

const num = (v: unknown): number => Number(v);

/** `0–31` oralig'idagi butun son (opozdaniya soni). */
function inIntRange(v: unknown, min: number, max: number): boolean {
  const n = num(v);
  return Number.isFinite(n) && n >= min && n <= max;
}

/* ───────────────────────── lateness ───────────────────────── */

export function latenessOk(lateness: TabelSettingsDict): boolean {
  return (
    inIntRange(lateness.excusedPerMonth, 0, 31) &&
    inIntRange(lateness.excusedMaxMinutes, 1, 1440) &&
    inIntRange(lateness.earlyLeaveGraceMinutes, 0, 240)
  );
}

/* ───────────────────────── punch-video ───────────────────────── */

export function punchVideoOk(pv: TabelSettingsDict): boolean {
  const minSec = num(pv.minSec ?? 5);
  const maxSec = num(pv.maxSec ?? 10);
  return (
    Number.isFinite(minSec) &&
    Number.isFinite(maxSec) &&
    minSec >= 5 &&
    maxSec <= 10 &&
    minSec <= maxSec
  );
}

/* ───────────────────────── face-antifraud ───────────────────────── */

export function faceAntifraudOk(fa: TabelSettingsDict): boolean {
  const face = num(fa.faceMatchThreshold ?? 0.85);
  const sface = num(fa.sfaceThreshold ?? 0.45);
  const gps = num(fa.maxGpsAccuracyM ?? 100);
  const skew = num(fa.maxClockSkewSec ?? 300);
  const dirs = num(fa.livenessDirections ?? 4);
  return (
    face >= 0.3 &&
    face <= 0.99 &&
    sface >= 0.25 &&
    sface <= 0.95 &&
    gps >= 15 &&
    gps <= 1000 &&
    skew >= 30 &&
    skew <= 3600 &&
    (dirs === 4 || dirs === 8)
  );
}

/* ───────────────────────── telegram ───────────────────────── */

export type BranchChatRow = { branch: string; chat: string };

/**
 * Telegram yoqilgan bo'lsa — token va kamida bitta chat ID (umumiy yoki filial)
 * bo'lishi shart. O'chirilgan bo'lsa — hech narsa talab qilinmaydi.
 */
export function telegramOk(tg: TabelSettingsDict, branchChatRows: BranchChatRow[]): boolean {
  if (!tg.enabled) return true;
  const hasToken = Boolean(tg.hasBotToken) || String(tg.botToken ?? "").trim().length > 0;
  const hasChat = String(tg.defaultChatId ?? "").trim().length > 0 || branchChatRows.length > 0;
  return hasToken && hasChat;
}

/* ───────────────────────── retention ───────────────────────── */

export function photoPolicyOk(p: Record<string, unknown> | undefined): boolean {
  if (!p || p.enabled === false) return true;
  const v = num(p.retentionValue);
  const u = String(p.retentionUnit ?? "day");
  return (
    Number.isFinite(v) && v >= 1 && v <= 3650 && (u === "day" || u === "month" || u === "year")
  );
}

export function retentionOk(ret: TabelSettingsDict): boolean {
  const video = num(ret.videoDays ?? 30);
  const face = num(ret.dismissedFacePurgeDays ?? 30);
  const edge = num(ret.compress?.maxEdge ?? 720);
  const quality = num(ret.compress?.quality ?? 62);
  return (
    photoPolicyOk(ret.in) &&
    photoPolicyOk(ret.out) &&
    photoPolicyOk(ret.estimated_out) &&
    video >= 1 &&
    video <= 3650 &&
    face >= 0 &&
    face <= 3650 &&
    edge >= 240 &&
    edge <= 1920 &&
    quality >= 30 &&
    quality <= 95
  );
}

/* ───────────────────────── dictionaries ───────────────────────── */

/** Har bir spravochnikda kamida 1 yozuv, kodlar unikal, kod va RU nomi bo'sh emas. */
export function dictionariesOk(cur: TabelSettingsDict): boolean {
  const abs = (cur.dictionaries?.absenceTypes ?? []) as Array<Record<string, unknown>>;
  const clr = (cur.dictionaries?.clearanceItems ?? []) as Array<Record<string, unknown>>;
  if (abs.length < 1 || clr.length < 1) return false;

  const valid = (rows: Array<Record<string, unknown>>): boolean => {
    const codes = new Set<string>();
    for (const row of rows) {
      const code = String(row.code ?? "").trim();
      const ru = String(row.labelRu ?? "").trim();
      if (!code || !ru || codes.has(code)) return false;
      codes.add(code);
    }
    return true;
  };

  return valid(abs) && valid(clr);
}

/* ───────────────────────── bo'lim validatsiyasi ───────────────────────── */

export type TabelValidationContext = {
  cur: TabelSettingsDict;
  branchChatRows: BranchChatRow[];
};

/** Bo'lim bo'yicha validatsiya; `null` = validatsiya talab qilinmaydi. */
export function sectionValid(section: string, ctx: TabelValidationContext): boolean | null {
  const { cur, branchChatRows } = ctx;
  switch (section) {
    case "lateness-rules":
      return latenessOk(cur.lateness ?? {});
    case "punch-video":
      return punchVideoOk(cur.punchVideo ?? {});
    case "face-antifraud":
      return faceAntifraudOk(cur.faceAntifraud ?? {});
    case "telegram-attendance":
      return telegramOk(cur.telegram ?? {}, branchChatRows);
    case "retention":
      return retentionOk(cur.retention ?? {});
    case "dictionaries":
      return dictionariesOk(cur);
    default:
      return null;
  }
}

/** Validatsiya yiqilganda ko'rsatiladigan xabar (ru). */
export const SECTION_ERROR_MESSAGES: Record<string, string> = {
  "lateness-rules": "Проверьте числа: опоздания 0–31, минуты прощения 1–1440, ранняя льгота 0–240.",
  "punch-video": "Длительность видео: минимум 5, максимум 10, минимум не больше максимума.",
  "face-antifraud":
    "Проверьте числа: лицо 0.30–0.99, SFace 0.25–0.95, GPS 15–1000, часы 30–3600, Liveness 4 или 8.",
  "telegram-attendance":
    "При включённой отправке нужны Bot Token и хотя бы один Chat ID (общий или по филиалу).",
  retention:
    "Проверьте сроки: фото 1–3650, видео 1–3650, лицо 0–3650, сторона 240–1920, JPEG 30–95.",
  dictionaries:
    "Нужны уникальные коды и названия (RU) хотя бы для одного вида отсутствия и одного пункта обходного."
};

/* ───────────────────────── punch-modes ───────────────────────── */

export const PUNCH_METHOD_KEYS: PunchMethodKey[] = ["photo", "video", "kiosk", "terminal"];

/** Bazaviy usullar: aniq `false` bo'lmasa — yoqilgan hisoblanadi. */
export function resolvePunchMethods(
  modes: PunchModesValue | undefined
): Record<PunchMethodKey, boolean> {
  const m = modes?.methods ?? {};
  return {
    photo: m.photo !== false,
    video: m.video !== false,
    kiosk: m.kiosk !== false,
    terminal: m.terminal !== false
  };
}

/** Rol uchun aniq qiymat: `default` (meros) / `on` / `off`. */
export function roleMethodValue(
  byRole: Record<string, Partial<Record<PunchMethodKey, boolean>>>,
  role: string,
  key: PunchMethodKey
): RoleMethodValue {
  const o = byRole[role];
  if (!o || typeof o[key] !== "boolean") return "default";
  return o[key] ? "on" : "off";
}

/** Rol qiymatini o'zgartirish; `null` — merosga qaytarish (bo'sh guruh o'chiriladi). */
export function applyRoleMethod(
  byRole: Record<string, Partial<Record<PunchMethodKey, boolean>>>,
  role: string,
  key: PunchMethodKey,
  value: boolean | null
): Record<string, Partial<Record<PunchMethodKey, boolean>>> {
  const next = { ...byRole };
  const prev = { ...(next[role] ?? {}) };
  if (value === null) {
    delete prev[key];
    if (Object.keys(prev).length === 0) delete next[role];
    else next[role] = prev;
  } else {
    next[role] = { ...prev, [key]: value };
  }
  return next;
}

/** Rol bo'yicha barcha override'larni tozalash. */
export function clearRole(
  byRole: Record<string, Partial<Record<PunchMethodKey, boolean>>>,
  role: string
): Record<string, Partial<Record<PunchMethodKey, boolean>>> {
  const next = { ...byRole };
  delete next[role];
  return next;
}

/** Telegram `branchChatIds` obyektidan jadval qatorlari (bo'shlari tashlanadi). */
export function branchChatRowsOf(tg: TabelSettingsDict): BranchChatRow[] {
  const raw = (tg.branchChatIds ?? {}) as Record<string, string>;
  return Object.entries(raw)
    .filter(([, chat]) => String(chat ?? "").trim())
    .map(([branch, chat]) => ({ branch, chat: String(chat).trim() }))
    .sort((a, b) => a.branch.localeCompare(b.branch, "ru"));
}

/** Video-отметка istisnolari: `{ id: { enabled, codeRequired } }` dan saralangan ro'yxat. */
export type UserOverrideRow = { id: number; enabled: boolean; codeRequired: boolean };

export function userOverridesOf(pv: TabelSettingsDict): UserOverrideRow[] {
  const raw = (pv.userOverrides ?? {}) as Record<
    string,
    { enabled?: boolean; codeRequired?: boolean }
  >;
  return Object.entries(raw)
    .map(([id, row]) => ({
      id: Number(id),
      enabled: row.enabled !== false,
      codeRequired: row.codeRequired !== false
    }))
    .filter((r) => Number.isFinite(r.id) && r.id > 0)
    .sort((a, b) => a.id - b.id);
}

/** Kiosk rejimi uchun qo'shimcha rahbarlar ro'yxati (musbat butun sonlar). */
export function kioskLeaderIdsOf(fa: TabelSettingsDict): number[] {
  const raw = Array.isArray(fa.kioskLeaderIds) ? fa.kioskLeaderIds : [];
  return raw.map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0);
}
