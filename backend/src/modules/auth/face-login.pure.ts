import { createHash, randomBytes } from "node:crypto";

export const FACE_LOGIN_TTL_MS = 120_000;
/** Eski challenge orqali recreate — to‘liq qayta login siz (max). */
export const FACE_LOGIN_RECREATE_WINDOW_MS = 30 * 60_000;
export const FACE_LOGIN_CONTEXT = "web_login" as const;

export type FaceLoginStatus = "pending" | "approved" | "rejected" | "expired";
export type FaceLoginChannel = "webcam" | "qr_phone";

const FOUR: readonly string[] = ["left", "right", "up", "down"];
const EIGHT: readonly string[] = [
  "left",
  "right",
  "up",
  "down",
  "up-left",
  "up-right",
  "down-left",
  "down-right"
];

export function hashFaceChallengeToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newFaceChallengeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function pickLivenessDirections(count: 4 | 8): string[] {
  const pool = count === 8 ? [...EIGHT] : [...FOUR];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = a;
  }
  return pool.slice(0, count);
}

/** Admin hech qachon Face ID login gate ga tushmaydi. */
export function isFaceLoginExemptRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === "admin";
}

/** Per-user toggle yoki tenant faceAntifraud.requireFaceLogin. Admin — doim false. */
export function shouldRequireFaceLogin(opts: {
  userRequireFaceLogin: boolean;
  tenantRequireFaceLogin: boolean;
  role?: string | null;
}): boolean {
  if (isFaceLoginExemptRole(opts.role)) return false;
  return opts.userRequireFaceLogin === true || opts.tenantRequireFaceLogin === true;
}

/** Login gate: bayroq yoqilgan VA etalon bor. Aks holda oddiy parol. */
export function shouldChallengeFaceLogin(opts: {
  userRequireFaceLogin: boolean;
  tenantRequireFaceLogin: boolean;
  role?: string | null;
  hasReference: boolean;
}): boolean {
  if (!shouldRequireFaceLogin(opts)) return false;
  return opts.hasReference === true;
}

export function resolveChallengeLifecycle(opts: {
  status: string;
  expiresAtMs: number;
  nowMs: number;
}): FaceLoginStatus {
  if (opts.status === "approved" || opts.status === "rejected") {
    return opts.status;
  }
  if (opts.status !== "pending" || opts.nowMs >= opts.expiresAtMs) {
    return "expired";
  }
  return "pending";
}

export function faceBridgePath(rawToken: string): string {
  return `/face-bridge/${encodeURIComponent(rawToken)}`;
}

function isLikelyApiOnlyOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const port = u.port || (u.protocol === "https:" ? "443" : "80");
    /* Lokal Fastify default — bridge frontendda, API da emas. */
    return port === "18080" || port === "4000";
  } catch {
    return false;
  }
}

/** Proxy Host (API:18080) o‘rniga brauzer Origin / PUBLIC env. */
export function resolveFaceBridgePublicOrigin(input: {
  publicOrigin?: string | null;
  headers?: {
    origin?: string | string[];
    "x-forwarded-proto"?: string | string[];
    "x-forwarded-host"?: string | string[];
    host?: string | string[];
  };
  env?: NodeJS.ProcessEnv;
}): string {
  const env = input.env ?? process.env;
  const envOrigin =
    env.FACE_BRIDGE_PUBLIC_ORIGIN?.trim() ||
    env.PUBLIC_APP_URL?.trim() ||
    env.NEXT_PUBLIC_FACE_BRIDGE_ORIGIN?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (envOrigin) return envOrigin.replace(/\/$/, "");

  const hdr = input.headers;
  if (hdr) {
    const originHdr = hdr.origin;
    if (typeof originHdr === "string" && /^https?:\/\//i.test(originHdr.trim())) {
      return originHdr.trim().replace(/\/$/, "");
    }
  }

  const fromInput = input.publicOrigin?.trim().replace(/\/$/, "") || "";
  if (fromInput && !isLikelyApiOnlyOrigin(fromInput)) return fromInput;
  return fromInput;
}
