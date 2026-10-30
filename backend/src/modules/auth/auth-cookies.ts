import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env";

/** HttpOnly refresh token cookie — web brauzer uchun (mobil JSON body ishlatadi). */
export const REFRESH_COOKIE_NAME = "salec_rt";
const REFRESH_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function secureSuffix(): string {
  return env.NODE_ENV === "production" ? "; Secure" : "";
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    out[key] = val;
  }
  return out;
}

export function setRefreshTokenCookie(reply: FastifyReply, refreshToken: string): void {
  reply.header(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${REFRESH_MAX_AGE_SEC}${secureSuffix()}`
  );
}

export function clearRefreshTokenCookie(reply: FastifyReply): void {
  reply.header(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureSuffix()}`
  );
}

export function readRefreshTokenFromRequest(request: FastifyRequest): string | null {
  const cookies = parseCookieHeader(request.headers.cookie);
  const fromCookie = cookies[REFRESH_COOKIE_NAME];
  if (typeof fromCookie === "string" && fromCookie.trim() !== "") {
    return fromCookie.trim();
  }
  return null;
}

export function resolveRefreshTokenInput(
  request: FastifyRequest,
  bodyToken?: string | null
): string | null {
  const cookie = readRefreshTokenFromRequest(request);
  if (cookie) return cookie;
  const body = bodyToken?.trim();
  return body ? body : null;
}
