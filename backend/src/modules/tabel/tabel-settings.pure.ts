/**
 * «Настройки → Табель, Face ID и посещаемость» uchun sozlamalar sxemasi,
 * 3 xonali kunlik kod, 10 qatlamli Anti-Fraud va retention hisob-kitoblari (pure).
 */
import {
  DEFAULT_LATENESS_RULES,
  normalizeLatenessRules,
  type LatenessRules
} from "./tabel-engine.pure";

export const PUNCH_VIDEO_MIN_SEC = 5;
export const PUNCH_VIDEO_MAX_SEC = 10;
export const PUNCH_VIDEO_MIN_BYTES = 10_000;
export const PUNCH_VIDEO_MAX_BYTES = 15 * 1024 * 1024;
export const PUNCH_CODE_MIN = 100;
export const PUNCH_CODE_MAX = 999;

export type PunchVideoUserOverride = {
  enabled: boolean;
  codeRequired: boolean;
};

export type PunchVideoSettings = {
  enabled: boolean;
  codeRequired: boolean;
  minSec: number;
  maxSec: number;
  captureMode: "simultaneous" | "sequential";
  allowAllStaffByDefault: boolean;
  userOverrides: Record<string, PunchVideoUserOverride>;
};

export const DEFAULT_PUNCH_VIDEO_SETTINGS: PunchVideoSettings = {
  enabled: true,
  codeRequired: true,
  minSec: PUNCH_VIDEO_MIN_SEC,
  maxSec: PUNCH_VIDEO_MAX_SEC,
  captureMode: "sequential",
  allowAllStaffByDefault: true,
  userOverrides: {}
};

export type FaceAntifraudSettings = {
  faceMatchThreshold: number;
  sfaceThreshold: number;
  livenessDirections: 4 | 8;
  requireSingleFace: boolean;
  maxGpsAccuracyM: number;
  blockMockGps: boolean;
  notifyHrOnFraud: boolean;
  maxClockSkewSec: number;
  blockGalleryPhotos: boolean;
  requireDualCameraPhoto: boolean;
  kioskLeaderIds: number[];
  requireFaceEnrollmentOnStaffCreate: boolean;
  requireFaceLogin: boolean;
};

export const DEFAULT_FACE_ANTIFRAUD_SETTINGS: FaceAntifraudSettings = {
  faceMatchThreshold: 0.85,
  sfaceThreshold: 0.45,
  livenessDirections: 4,
  requireSingleFace: true,
  maxGpsAccuracyM: 100,
  blockMockGps: true,
  notifyHrOnFraud: true,
  maxClockSkewSec: 300,
  blockGalleryPhotos: true,
  requireDualCameraPhoto: true,
  kioskLeaderIds: [],
  requireFaceEnrollmentOnStaffCreate: false,
  requireFaceLogin: false
};

export type TelegramAttendanceSettings = {
  enabled: boolean;
  botToken: string;
  hasBotToken?: boolean;
  defaultChatId: string;
  branchChatIds: Record<string, string>;
  sendPhotos: boolean;
  sendVideos: boolean;
  sendFraudAlerts: boolean;
};

export const DEFAULT_TELEGRAM_ATTENDANCE_SETTINGS: TelegramAttendanceSettings = {
  enabled: false,
  botToken: "",
  defaultChatId: "",
  branchChatIds: {},
  sendPhotos: true,
  sendVideos: true,
  sendFraudAlerts: true
};

export type MarkPhotoRetentionUnit = "day" | "month" | "year";

export type MarkPhotoPolicy = {
  enabled: boolean;
  retentionValue: number;
  retentionUnit: MarkPhotoRetentionUnit;
};

export type TabelRetentionSettings = {
  in: MarkPhotoPolicy;
  out: MarkPhotoPolicy;
  estimated_out: MarkPhotoPolicy;
  videoDays: number;
  dismissedFacePurgeDays: number;
  compress: {
    enabled: boolean;
    maxEdge: number;
    quality: number;
  };
};

export const DEFAULT_TABEL_RETENTION_SETTINGS: TabelRetentionSettings = {
  in: { enabled: true, retentionValue: 90, retentionUnit: "day" },
  out: { enabled: true, retentionValue: 90, retentionUnit: "day" },
  estimated_out: { enabled: true, retentionValue: 30, retentionUnit: "day" },
  videoDays: 30,
  dismissedFacePurgeDays: 30,
  compress: {
    enabled: true,
    maxEdge: 720,
    quality: 62
  }
};

export type AbsenceDictionaryItem = {
  code: string;
  labelRu: string;
  labelUz: string;
  paid: boolean;
  requiresAttachment: boolean;
};

export type ClearanceDictionaryItem = {
  code: string;
  labelRu: string;
  department: string;
};

export type TabelDictionariesSettings = {
  absenceTypes: AbsenceDictionaryItem[];
  clearanceItems: ClearanceDictionaryItem[];
};

export const DEFAULT_TABEL_DICTIONARIES: TabelDictionariesSettings = {
  absenceTypes: [
    { code: "vacation", labelRu: "Ежегодный отпуск", labelUz: "Yillik ta'til", paid: true, requiresAttachment: false },
    { code: "sick", labelRu: "Больничный лист", labelUz: "Kasallik varaqasi", paid: true, requiresAttachment: true },
    { code: "trip", labelRu: "Командировка", labelUz: "Xizmat safari", paid: true, requiresAttachment: false },
    { code: "unpaid_leave", labelRu: "Отпуск без содержания (БС)", labelUz: "O'z hisobidan ta'til", paid: false, requiresAttachment: false },
    { code: "overtime", labelRu: "Сверхурочная работа", labelUz: "Ish vaqtidan tashqari", paid: true, requiresAttachment: false },
    { code: "weekend_work", labelRu: "Работа в выходной", labelUz: "Dam olish kunidagi ish", paid: true, requiresAttachment: false }
  ],
  clearanceItems: [
    { code: "warehouse", labelRu: "Склад и ТМЦ (возврат остатков)", department: "Склад" },
    { code: "cash", labelRu: "Касса и подотчётные средства", department: "Бухгалтерия / Касса" },
    { code: "consignment", labelRu: "Консигнация и долги клиентов", department: "Отдел продаж" },
    { code: "equipment", labelRu: "Планшет, телефон и инвентарь", department: "IT / Оборудование" },
    { code: "work_slot", labelRu: "Сдача рабочего места (слота)", department: "HR / Супервайзер" }
  ]
};

export type FullTabelSettings = {
  lateness: LatenessRules;
  punchVideo: PunchVideoSettings;
  faceAntifraud: FaceAntifraudSettings;
  telegram: TelegramAttendanceSettings;
  retention: TabelRetentionSettings;
  dictionaries: TabelDictionariesSettings;
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function retentionToDays(value: unknown, unit: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  const u = String(unit || "day").toLowerCase();
  if (u === "year") return n * 365;
  if (u === "month") return n * 30;
  return n;
}

function normalizePhotoPolicy(raw: unknown, fallback: MarkPhotoPolicy): MarkPhotoPolicy {
  const o = asObj(raw);
  const unitRaw = String(o.retentionUnit || fallback.retentionUnit).toLowerCase();
  const retentionUnit: MarkPhotoRetentionUnit =
    unitRaw === "month" || unitRaw === "year" || unitRaw === "day" ? unitRaw : fallback.retentionUnit;
  const retentionValue = Number.isFinite(Number(o.retentionValue))
    ? Math.max(0, Math.floor(Number(o.retentionValue)))
    : fallback.retentionValue;
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : fallback.enabled,
    retentionValue,
    retentionUnit
  };
}

export function normalizeFullTabelSettings(raw: unknown): FullTabelSettings {
  const root = asObj(raw);
  const pv = asObj(root.punchVideo);
  const fa = asObj(root.faceAntifraud);
  const tg = asObj(root.telegram);
  const ret = asObj(root.retention);
  const comp = asObj(ret.compress);
  const dict = asObj(root.dictionaries);

  const userOverrides: Record<string, PunchVideoUserOverride> = {};
  for (const [k, v] of Object.entries(asObj(pv.userOverrides))) {
    const o = asObj(v);
    userOverrides[k] = {
      enabled: o.enabled !== false,
      codeRequired: o.codeRequired !== false
    };
  }

  const branchChatIds: Record<string, string> = {};
  for (const [k, v] of Object.entries(asObj(tg.branchChatIds))) {
    if (typeof v === "string" && v.trim()) branchChatIds[k.trim()] = v.trim();
  }

  return {
    lateness: normalizeLatenessRules(root.lateness),
    punchVideo: {
      enabled: typeof pv.enabled === "boolean" ? pv.enabled : DEFAULT_PUNCH_VIDEO_SETTINGS.enabled,
      codeRequired: typeof pv.codeRequired === "boolean" ? pv.codeRequired : DEFAULT_PUNCH_VIDEO_SETTINGS.codeRequired,
      minSec: Number.isFinite(Number(pv.minSec)) ? Math.max(3, Math.min(15, Number(pv.minSec))) : PUNCH_VIDEO_MIN_SEC,
      maxSec: Number.isFinite(Number(pv.maxSec)) ? Math.max(5, Math.min(30, Number(pv.maxSec))) : PUNCH_VIDEO_MAX_SEC,
      captureMode: pv.captureMode === "simultaneous" ? "simultaneous" : "sequential",
      allowAllStaffByDefault:
        typeof pv.allowAllStaffByDefault === "boolean"
          ? pv.allowAllStaffByDefault
          : DEFAULT_PUNCH_VIDEO_SETTINGS.allowAllStaffByDefault,
      userOverrides
    },
    faceAntifraud: {
      faceMatchThreshold: Number.isFinite(Number(fa.faceMatchThreshold))
        ? Math.max(0.3, Math.min(0.99, Number(fa.faceMatchThreshold)))
        : DEFAULT_FACE_ANTIFRAUD_SETTINGS.faceMatchThreshold,
      sfaceThreshold: Number.isFinite(Number(fa.sfaceThreshold))
        ? Math.max(0.25, Math.min(0.95, Number(fa.sfaceThreshold)))
        : DEFAULT_FACE_ANTIFRAUD_SETTINGS.sfaceThreshold,
      livenessDirections: Number(fa.livenessDirections) === 8 ? 8 : 4,
      requireSingleFace:
        typeof fa.requireSingleFace === "boolean" ? fa.requireSingleFace : DEFAULT_FACE_ANTIFRAUD_SETTINGS.requireSingleFace,
      maxGpsAccuracyM: Number.isFinite(Number(fa.maxGpsAccuracyM))
        ? Math.max(15, Math.min(1000, Number(fa.maxGpsAccuracyM)))
        : DEFAULT_FACE_ANTIFRAUD_SETTINGS.maxGpsAccuracyM,
      blockMockGps: typeof fa.blockMockGps === "boolean" ? fa.blockMockGps : DEFAULT_FACE_ANTIFRAUD_SETTINGS.blockMockGps,
      notifyHrOnFraud:
        typeof fa.notifyHrOnFraud === "boolean" ? fa.notifyHrOnFraud : DEFAULT_FACE_ANTIFRAUD_SETTINGS.notifyHrOnFraud,
      maxClockSkewSec: Number.isFinite(Number(fa.maxClockSkewSec))
        ? Math.max(30, Math.min(3600, Number(fa.maxClockSkewSec)))
        : DEFAULT_FACE_ANTIFRAUD_SETTINGS.maxClockSkewSec,
      blockGalleryPhotos:
        typeof fa.blockGalleryPhotos === "boolean"
          ? fa.blockGalleryPhotos
          : DEFAULT_FACE_ANTIFRAUD_SETTINGS.blockGalleryPhotos,
      requireDualCameraPhoto:
        typeof fa.requireDualCameraPhoto === "boolean"
          ? fa.requireDualCameraPhoto
          : DEFAULT_FACE_ANTIFRAUD_SETTINGS.requireDualCameraPhoto,
      kioskLeaderIds: Array.isArray(fa.kioskLeaderIds)
        ? fa.kioskLeaderIds.map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0)
        : [],
      requireFaceEnrollmentOnStaffCreate:
        typeof fa.requireFaceEnrollmentOnStaffCreate === "boolean"
          ? fa.requireFaceEnrollmentOnStaffCreate
          : false,
      requireFaceLogin: typeof fa.requireFaceLogin === "boolean" ? fa.requireFaceLogin : false
    },
    telegram: {
      enabled: typeof tg.enabled === "boolean" ? tg.enabled : DEFAULT_TELEGRAM_ATTENDANCE_SETTINGS.enabled,
      botToken: typeof tg.botToken === "string" ? tg.botToken.trim() : "",
      defaultChatId: typeof tg.defaultChatId === "string" ? tg.defaultChatId.trim() : "",
      branchChatIds,
      sendPhotos: typeof tg.sendPhotos === "boolean" ? tg.sendPhotos : true,
      sendVideos: typeof tg.sendVideos === "boolean" ? tg.sendVideos : true,
      sendFraudAlerts: typeof tg.sendFraudAlerts === "boolean" ? tg.sendFraudAlerts : true
    },
    retention: {
      in: normalizePhotoPolicy(ret.in, DEFAULT_TABEL_RETENTION_SETTINGS.in),
      out: normalizePhotoPolicy(ret.out, DEFAULT_TABEL_RETENTION_SETTINGS.out),
      estimated_out: normalizePhotoPolicy(ret.estimated_out, DEFAULT_TABEL_RETENTION_SETTINGS.estimated_out),
      videoDays: Number.isFinite(Number(ret.videoDays))
        ? Math.max(1, Math.min(3650, Math.floor(Number(ret.videoDays))))
        : DEFAULT_TABEL_RETENTION_SETTINGS.videoDays,
      dismissedFacePurgeDays: Number.isFinite(Number(ret.dismissedFacePurgeDays))
        ? Math.max(0, Math.min(3650, Math.floor(Number(ret.dismissedFacePurgeDays))))
        : DEFAULT_TABEL_RETENTION_SETTINGS.dismissedFacePurgeDays,
      compress: {
        enabled: typeof comp.enabled === "boolean" ? comp.enabled : true,
        maxEdge: Number.isFinite(Number(comp.maxEdge))
          ? Math.max(240, Math.min(1920, Math.floor(Number(comp.maxEdge))))
          : 720,
        quality: Number.isFinite(Number(comp.quality))
          ? Math.max(30, Math.min(95, Math.floor(Number(comp.quality))))
          : 62
      }
    },
    dictionaries: {
      absenceTypes: Array.isArray(dict.absenceTypes) && dict.absenceTypes.length > 0
        ? (dict.absenceTypes as AbsenceDictionaryItem[])
        : DEFAULT_TABEL_DICTIONARIES.absenceTypes,
      clearanceItems: Array.isArray(dict.clearanceItems) && dict.clearanceItems.length > 0
        ? (dict.clearanceItems as ClearanceDictionaryItem[])
        : DEFAULT_TABEL_DICTIONARIES.clearanceItems
    }
  };
}

/** Ekranga qaytarishda botToken yashiriladi va `hasBotToken` bayrog'i beriladi. */
export function maskTabelSettingsForClient(settings: FullTabelSettings): FullTabelSettings {
  return {
    ...settings,
    telegram: {
      ...settings.telegram,
      hasBotToken: Boolean(settings.telegram.botToken),
      botToken: ""
    }
  };
}

/** Pick a free 3-digit code, 100..999. */
export function pickDayCode(used: Set<number>, random: () => number = Math.random): number | null {
  const span = PUNCH_CODE_MAX - PUNCH_CODE_MIN + 1;
  let taken = 0;
  for (const code of used) if (code >= PUNCH_CODE_MIN && code <= PUNCH_CODE_MAX) taken++;
  if (taken >= span) return null;
  for (let i = 0; i < 40; i++) {
    const code = PUNCH_CODE_MIN + Math.floor(random() * span);
    if (!used.has(code)) return code;
  }
  for (let code = PUNCH_CODE_MIN; code <= PUNCH_CODE_MAX; code++) if (!used.has(code)) return code;
  return null;
}

export function assertVideoPunch(input: {
  durationSec: number;
  bytes: number;
  enabled: boolean;
  codeRequired: boolean;
  code: number | null;
  spokenCode?: number | null;
  minSec?: number;
  maxSec?: number;
}) {
  if (!input.enabled) {
    return { ok: false as const, code: "PUNCH_VIDEO_DISABLED", message: "Video bilan belgilash o‘chirilgan" };
  }
  const minS = input.minSec ?? PUNCH_VIDEO_MIN_SEC;
  const maxS = input.maxSec ?? PUNCH_VIDEO_MAX_SEC;
  if (input.durationSec < minS || input.durationSec > maxS) {
    return {
      ok: false as const,
      code: "PUNCH_VIDEO_DURATION",
      message: `Video ${minS}–${maxS} soniya bo‘lishi kerak`
    };
  }
  if (input.bytes < PUNCH_VIDEO_MIN_BYTES || input.bytes > PUNCH_VIDEO_MAX_BYTES) {
    return { ok: false as const, code: "PUNCH_VIDEO_SIZE", message: "Video hajmi mos emas" };
  }
  if (input.codeRequired) {
    if (!input.code || Number(input.spokenCode) !== input.code) {
      return { ok: false as const, code: "PUNCH_VIDEO_CODE", message: "Ekrandagi 3 xonali kunlik kod mos kelmadi" };
    }
  }
  return { ok: true as const };
}
