import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";
import { DEFAULT_FACE_MATCH_THRESHOLD } from "./face-match.pure";

export type FaceVerifyContext =
  | "daily_login"
  | "order_submit"
  | "territory_check"
  | "delivery_confirm"
  | "payment_accept";

export type FaceVerificationPolicy = {
  enabled: boolean;
  dailyLogin: boolean;
  maxRandomOrdersPerDay: number;
  territoryCheck: boolean;
};

export type UiPrefs = Record<string, unknown>;

export const REF_KEY = "face_reference_storage_key";
export const REF_AT = "face_reference_uploaded_at";
export const REF_DESC = "face_reference_descriptor";
export const MAX_IMAGE_BYTES = 900_000;

export function matchThreshold(): number {
  const raw = process.env.FACE_MATCH_THRESHOLD;
  if (raw == null || raw.trim() === "") return DEFAULT_FACE_MATCH_THRESHOLD;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_FACE_MATCH_THRESHOLD;
  return Math.min(0.99, Math.max(0.5, n));
}

export function readUiPrefs(raw: unknown): UiPrefs {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return { ...(raw as UiPrefs) };
  }
  return {};
}

/** UTC+5 ish kuni */
export function workRegionDateString(d = new Date()): string {
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60_000;
  const t5 = new Date(utcMs + 5 * 3600_000);
  const y = t5.getUTCFullYear();
  const m = String(t5.getUTCMonth() + 1).padStart(2, "0");
  const day = String(t5.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function facePolicyFromMobileConfig(mc: AgentMobileConfigV1 | undefined): FaceVerificationPolicy {
  const misc = mc?.misc;
  return {
    enabled: misc?.face_verification_enabled === true,
    dailyLogin: misc?.face_verification_daily_login !== false,
    maxRandomOrdersPerDay: Math.min(
      5,
      Math.max(0, Math.trunc(misc?.face_verification_max_random_orders_per_day ?? 5))
    ),
    territoryCheck: misc?.face_verification_on_territory_check !== false
  };
}

/** Keyingi buyurtma (action_count+1) checkpointmi — side-effect yo‘q. */
export function isOrderSubmitFaceCheckpoint(input: {
  orderActionCount: number;
  orderVerifyCount: number;
  maxRandomOrdersPerDay: number;
  checkpoints: number[];
}): boolean {
  if (input.orderVerifyCount >= input.maxRandomOrdersPerDay) return false;
  const nextCount = input.orderActionCount + 1;
  return input.checkpoints.includes(nextCount);
}

export function decodeBase64Image(b64: string): { buf: Buffer; contentType: string } {
  const trimmed = b64.trim();
  let contentType = "image/jpeg";
  let payload = trimmed;
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(trimmed);
  if (m) {
    contentType = m[1]!.toLowerCase();
    payload = m[2]!;
  }
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 64) throw new Error("IMAGE_TOO_SMALL");
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
  return { buf, contentType };
}

export function storagePrefix(tenantId: number, userId: number): string {
  return `tenants/${tenantId}/users/${userId}/face`;
}
