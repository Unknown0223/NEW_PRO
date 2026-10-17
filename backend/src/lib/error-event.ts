import type { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { sanitizePayloadForAudit } from "./tenant-audit";

export type ErrorEventSource = "mobile" | "backend";
export type ErrorEventSeverity = "error" | "fatal";
export type ErrorEventPlatform = "android" | "ios" | "server";

export type AppendErrorEventInput = {
  tenantId: number;
  userId?: number | null;
  source: ErrorEventSource;
  severity?: ErrorEventSeverity;
  occurredAt?: Date;
  requestId?: string | null;
  httpStatus?: number | null;
  errorCode?: string | null;
  message: string;
  path?: string | null;
  method?: string | null;
  platform: ErrorEventPlatform;
  apkVersion?: string | null;
  deviceName?: string | null;
  deviceId?: string | null;
  module?: string | null;
  payload?: unknown;
};

/** Journal message — to‘liq matn (DB TEXT). Payload esa alohida JSON. */
const MAX_MSG = 8_000;
const MAX_ERROR_PAYLOAD_CHARS = 24_000;
const SKIP_PATH_RE = /\/error-events(\/|$)|\/auth\/(login|refresh)(\/|$)/i;

/** Ilova «Сессия завершена» — 401 ham jurnalga (APK yangilanmasdan, server yozadi). */
export const SESSION_JOURNAL_ERROR_CODES = new Set(["SESSION_REVOKED", "INVALID_REFRESH"]);
const SESSION_JOURNAL_DEBOUNCE_MS = 15 * 60 * 1000;

export function isSessionJournalErrorCode(code: string | null | undefined): boolean {
  return Boolean(code && SESSION_JOURNAL_ERROR_CODES.has(code));
}

/** Path bo‘yicha modul taxmini. */
export function inferErrorModule(path: string | null | undefined): string {
  const p = (path ?? "").toLowerCase();
  if (p.includes("/auth")) return "auth";
  if (p.includes("/sync")) return "sync";
  if (p.includes("/visit") || p.includes("/field")) return "visits";
  if (p.includes("/order")) return "orders";
  if (p.includes("/payment") || p.includes("/cash")) return "payments";
  if (p.includes("/client")) return "clients";
  if (p.includes("/photo")) return "photos";
  if (p.includes("/gps") || p.includes("/location")) return "gps";
  if (p.includes("/apk") || p.includes("/update") || p.includes("mobile-app")) return "update";
  if (p.includes("/timesheet") || p.includes("/tabel")) return "timesheet";
  if (p.includes("held") || p.includes("/queue")) return "held_orders";
  if (p.includes("/notif")) return "notifications";
  if (p.includes("/sqlite") || p.includes("/database") || p.includes("/db")) return "database";
  return "other";
}

export function shouldSkipErrorEventPath(path: string | null | undefined): boolean {
  return SKIP_PATH_RE.test(path ?? "");
}

/**
 * Backend avto-yozuv: 5xx doim; 4xx — 401 dan tashqari (auth flood).
 * `SESSION_REVOKED` / `INVALID_REFRESH` — 401 va /auth/refresh ham (mobil ping).
 * Ingest endpoint o‘zi yozilmaydi.
 */
export function shouldPersistBackendError(
  statusCode: number,
  path?: string | null,
  errorCode?: string | null
): boolean {
  if (isSessionJournalErrorCode(errorCode)) return true;
  if (errorCode === "WORKDAY_OFF") return false;
  if (shouldSkipErrorEventPath(path)) return false;
  if (statusCode >= 500) return true;
  if (statusCode === 401) return false;
  if (statusCode >= 400 && statusCode < 500) return true;
  return false;
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Fire-and-forget uchun: xato yozish DB ni bloklamasligi kerak. */
export function appendErrorEventSafe(input: AppendErrorEventInput): void {
  void appendErrorEvent(input).catch(() => {
    /* diagnostika o‘zi tizimni buzmasin */
  });
}

export async function appendErrorEvent(input: AppendErrorEventInput): Promise<{ id: number } | null> {
  const message = clip(input.message || "Unknown error", MAX_MSG);
  if (!message) return null;
  if (input.tenantId < 1) return null;

  const requestId = input.requestId?.trim().slice(0, 64) || null;
  // Bir xil HTTP so‘rov ikki marta (mobile+backend yoki race) — dublikat yaratilmasin
  if (requestId) {
    const since = new Date(Date.now() - 15_000);
    const existing = await prisma.errorEvent.findFirst({
      where: {
        tenant_id: input.tenantId,
        request_id: requestId,
        occurred_at: { gte: since }
      },
      select: { id: true },
      orderBy: { id: "desc" }
    });
    if (existing) return existing;
  }

  const errorCode = input.errorCode?.trim().slice(0, 128) || null;
  const userId = input.userId != null && input.userId > 0 ? Math.floor(input.userId) : null;
  if (isSessionJournalErrorCode(errorCode) && userId != null) {
    const since = new Date(Date.now() - SESSION_JOURNAL_DEBOUNCE_MS);
    const deviceId = input.deviceId?.trim().slice(0, 128) || null;
    const existing = await prisma.errorEvent.findFirst({
      where: {
        tenant_id: input.tenantId,
        user_id: userId,
        error_code: errorCode,
        occurred_at: { gte: since },
        ...(deviceId ? { device_id: deviceId } : {})
      },
      select: { id: true },
      orderBy: { id: "desc" }
    });
    if (existing) return existing;
  }

  const payload = sanitizeErrorEventPayload(input.payload ?? {});
  const row = await prisma.errorEvent.create({
    data: {
      tenant_id: input.tenantId,
      user_id: userId,
      source: input.source,
      severity: input.severity === "fatal" ? "fatal" : "error",
      occurred_at: input.occurredAt ?? new Date(),
      request_id: requestId,
      http_status: input.httpStatus ?? null,
      error_code: errorCode,
      message,
      path: input.path?.trim().slice(0, 255) || null,
      method: input.method?.trim().slice(0, 16) || null,
      platform: input.platform,
      apk_version: input.apkVersion?.trim().slice(0, 64) || null,
      device_name: input.deviceName?.trim().slice(0, 128) || null,
      device_id: input.deviceId?.trim().slice(0, 128) || null,
      module: (input.module?.trim() || inferErrorModule(input.path)).slice(0, 64),
      payload: payload as Prisma.InputJsonValue
    },
    select: { id: true }
  });
  return row;
}

/** Error journal uchun — audit’dan kattaroq limit, stack/response saqlanadi. */
function sanitizeErrorEventPayload(value: unknown): Record<string, unknown> {
  return sanitizePayloadForAudit(value, MAX_ERROR_PAYLOAD_CHARS);
}

export async function purgeOldErrorEvents(retentionDays: number): Promise<number> {
  const days = Math.max(1, Math.floor(retentionDays));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const r = await prisma.errorEvent.deleteMany({ where: { occurred_at: { lt: cutoff } } });
  return r.count;
}
