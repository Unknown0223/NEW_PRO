import { createHash } from "crypto";

/** Header yoki query `device_token` / `dt` — pairing_code e’tiborsiz. */
export function extractDeviceIngestToken(args: {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
}): string | null {
  const rawHeader = args.headers["x-device-token"] ?? args.headers["x-attendance-token"];
  const fromHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (typeof fromHeader === "string" && fromHeader.trim()) {
    return fromHeader.trim();
  }
  const q = args.query ?? {};
  for (const key of ["device_token", "dt"] as const) {
    const v = q[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function hashDeviceToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/** Prisma `user` qidiruvi: faqat employeeNo (body.user_id ishlatilmaydi). */
export function terminalEmployeeWhere(
  tenantId: number,
  employeeNo: string
): {
  tenant_id: number;
  is_active: true;
  OR: Array<{ code: string } | { id: number }>;
} {
  const asNumber = Number(employeeNo);
  return {
    tenant_id: tenantId,
    is_active: true,
    OR: [
      { code: employeeNo },
      ...(Number.isInteger(asNumber) && asNumber > 0 ? [{ id: asNumber }] : [])
    ]
  };
}

export const PAIRING_TTL_MS = 60 * 60 * 1000;

export function pairingExpiresAt(fromMs = Date.now()): Date {
  return new Date(fromMs + PAIRING_TTL_MS);
}

export function isPairingExpired(expiresAt: Date | null | undefined, nowMs = Date.now()): boolean {
  if (expiresAt == null) return false;
  return expiresAt.getTime() <= nowMs;
}
