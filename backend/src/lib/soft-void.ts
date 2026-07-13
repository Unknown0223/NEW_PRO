/**
 * Yagona soft-void / restore yordamchilari.
 *
 * Standart:
 * - Hujjat/operatsion: `deleted_at` + `deleted_by_user_id` (+ ixtiyoriy `delete_reason_ref`)
 * - HTTP DELETE = void; POST …/restore = restore
 * - Audit: `{entity}.void` / `{entity}.restore`
 * - Katalog/staff: `is_active=false` deactivate (bu helper emas)
 */

export const SoftVoidError = {
  NOT_FOUND: "NOT_FOUND",
  ALREADY_VOIDED: "ALREADY_VOIDED",
  NOT_VOIDED: "NOT_VOIDED",
  RESTORE_COMMENT_REQUIRED: "RESTORE_COMMENT_REQUIRED",
  REASON_REQUIRED: "REASON_REQUIRED",
  CANNOT_VOID: "CANNOT_VOID",
  CANNOT_RESTORE: "CANNOT_RESTORE"
} as const;

export type SoftVoidErrorCode = (typeof SoftVoidError)[keyof typeof SoftVoidError];

export type SoftVoidFields = {
  deleted_at: Date | null;
  deleted_by_user_id: number | null;
  delete_reason_ref?: string | null;
};

export type SoftVoidActor = number | null | undefined;

/** Actor user_id ni normalize qiladi (null yoki musbat butun). */
export function normalizeVoidActor(actorUserId: SoftVoidActor): number | null {
  if (actorUserId == null || !Number.isFinite(actorUserId) || actorUserId <= 0) return null;
  return Math.floor(Number(actorUserId));
}

/** Sabab matnini truncate (max 128). Bo‘sh → null. */
export function normalizeVoidReason(reason?: string | null, maxLen = 128): string | null {
  if (reason == null) return null;
  const t = String(reason).trim();
  if (!t) return null;
  return t.slice(0, maxLen);
}

/**
 * Soft-void uchun Prisma `data` obyekti.
 * `includeReason=false` — Territory kabi reason maydoni yo‘q modellarda.
 */
export function softVoidData(
  actorUserId: SoftVoidActor,
  reason?: string | null,
  opts?: { includeReason?: boolean; now?: Date }
): {
  deleted_at: Date;
  deleted_by_user_id: number | null;
  delete_reason_ref?: string | null;
} {
  const includeReason = opts?.includeReason !== false;
  const now = opts?.now ?? new Date();
  const base = {
    deleted_at: now,
    deleted_by_user_id: normalizeVoidActor(actorUserId)
  };
  if (!includeReason) return base;
  return { ...base, delete_reason_ref: normalizeVoidReason(reason) };
}

/** Restore uchun Prisma `data` — void maydonlarini tozalaydi. */
export function softRestoreData(opts?: { includeReason?: boolean }): {
  deleted_at: null;
  deleted_by_user_id: null;
  delete_reason_ref?: null;
} {
  const includeReason = opts?.includeReason !== false;
  if (!includeReason) {
    return { deleted_at: null, deleted_by_user_id: null };
  }
  return { deleted_at: null, deleted_by_user_id: null, delete_reason_ref: null };
}

/**
 * Ro‘yxat filtri: `archive=true` → faqat void; aks holda faqat aktiv.
 * `includeAll=true` → filtr yo‘q (admin ops).
 */
export function softVoidListFilter(
  archive?: boolean,
  opts?: { includeAll?: boolean }
): { deleted_at: null } | { deleted_at: { not: null } } | Record<string, never> {
  if (opts?.includeAll) return {};
  if (archive) return { deleted_at: { not: null } };
  return { deleted_at: null };
}

/** Void holatini tekshiradi; xato kodini tashlaydi. */
export function assertNotVoided(row: { deleted_at: Date | null } | null | undefined): void {
  if (!row) throw new Error(SoftVoidError.NOT_FOUND);
  if (row.deleted_at != null) throw new Error(SoftVoidError.ALREADY_VOIDED);
}

export function assertIsVoided(row: { deleted_at: Date | null } | null | undefined): void {
  if (!row) throw new Error(SoftVoidError.NOT_FOUND);
  if (row.deleted_at == null) throw new Error(SoftVoidError.NOT_VOIDED);
}

/** Moliyaviy restore uchun majburiy izoh. */
export function requireRestoreComment(comment: string | null | undefined): string {
  const t = comment != null ? String(comment).trim() : "";
  if (!t) throw new Error(SoftVoidError.RESTORE_COMMENT_REQUIRED);
  return t;
}

/**
 * Unique `(tenant_id, code)` to‘qnashuvini oldini olish:
 * void/deactivate qilinganda kodni `__void_{id}` suffix bilan o‘zgartirish.
 * `maxLen` — DB ustun uzunligi (default 80; katalog VarChar(64)).
 */
export function voidCodeSuffix(originalCode: string, entityId: number, maxLen = 80): string {
  const suffix = `__void_${entityId}`;
  const baseMax = Math.max(0, maxLen - suffix.length);
  const base = originalCode.slice(0, baseMax);
  return `${base}${suffix}`.slice(0, maxLen);
}

/** `__void_{id}` suffix bor-yo‘qligini tekshiradi. */
export function isVoidedCode(code: string): boolean {
  return /__void_\d+$/.test(code);
}

/** Void suffix ni olib tashlab original kodni qaytaradi. */
export function restoreVoidedCode(code: string): string {
  return code.replace(/__void_\d+$/, "");
}

/**
 * Deactivate/void qilingan koddan asl kodni qaytaradi.
 * Pattern mos kelmasa — `code` ni o‘zi qaytaradi (null emas).
 */
export function restoreCodeFromVoidSuffix(code: string, entityId: number): string {
  const suffix = `__void_${entityId}`;
  if (!code.endsWith(suffix)) return code;
  return code.slice(0, -suffix.length);
}

/** Katalog code: UI ≤24 + `__void_{id}` → VarChar(64). */
export const CATALOG_CODE_DB_MAX = 64;

/** Deactivate: is_active=false + kodni `__void_{id}` bilan bo‘shatish. */
export function catalogDeactivateData(code: string | null, entityId: number): {
  is_active: false;
  code?: string;
} {
  const data: { is_active: false; code?: string } = { is_active: false };
  if (code != null && code !== "" && !isVoidedCode(code)) {
    data.code = voidCodeSuffix(code, entityId, CATALOG_CODE_DB_MAX);
  }
  return data;
}

/** Restore: is_active=true + void suffix dan asl kodni qaytarish. */
export function catalogRestoreData(code: string | null, entityId: number): {
  is_active: true;
  code?: string | null;
} {
  const data: { is_active: true; code?: string | null } = { is_active: true };
  if (code != null && isVoidedCode(code)) {
    const restored = restoreCodeFromVoidSuffix(code, entityId);
    data.code = restored === "" ? null : restored;
  }
  return data;
}
