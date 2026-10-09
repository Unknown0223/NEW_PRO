import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { prisma } from "../config/database";
import { appendErrorEventSafe, inferErrorModule } from "./error-event";
import { resolveRefreshTokenInput } from "../modules/auth/auth-cookies";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function requestPath(request: FastifyRequest): string {
  return (request.url?.split("?")[0] ?? "").slice(0, 255);
}

function requestUserAgent(request: FastifyRequest): string {
  const raw = request.headers["user-agent"];
  return typeof raw === "string" ? raw : "";
}

/**
 * `/auth/refresh` da JWT yo‘q — refresh token qatoridan user/tenant olib jurnalga yozamiz.
 * Noma’lum token (hujum/typo) — yozilmaydi.
 */
export function appendInvalidRefreshJournalSafe(
  request: FastifyRequest,
  statusCode: number,
  message?: string
): void {
  void (async () => {
    const body = request.body as { refreshToken?: string | null } | undefined;
    const raw = resolveRefreshTokenInput(request, body?.refreshToken);
    if (!raw) return;

    const row = await prisma.refreshToken.findUnique({
      where: { token_hash: hashToken(raw) },
      select: {
        tenant_id: true,
        user_id: true,
        device_id: true,
        device_name: true,
        revoked_at: true,
        expires_at: true,
        user: { select: { login: true, role: true, apk_version: true, device_name: true } }
      }
    });
    if (!row) return;

    const ua = requestUserAgent(request);
    const mobile = /SalecMobile|Dart\/|okhttp|Flutter/i.test(ua);
    const path = requestPath(request);

    appendErrorEventSafe({
      tenantId: row.tenant_id,
      userId: row.user_id,
      source: mobile ? "mobile" : "backend",
      severity: "error",
      requestId: request.id,
      httpStatus: statusCode,
      errorCode: "INVALID_REFRESH",
      message: message?.trim() || "Сессия завершена. Войдите снова.",
      path,
      method: request.method,
      platform: mobile ? "android" : "server",
      apkVersion: row.user.apk_version,
      deviceName: row.device_name ?? row.user.device_name,
      deviceId: row.device_id,
      module: inferErrorModule(path),
      payload: {
        login: row.user.login,
        role: row.user.role,
        token_revoked: row.revoked_at != null,
        token_expired: row.expires_at < new Date(),
        user_agent: ua.slice(0, 255) || null
      }
    });
  })().catch(() => {
    /* diagnostika o‘zi tizimni buzmasin */
  });
}
