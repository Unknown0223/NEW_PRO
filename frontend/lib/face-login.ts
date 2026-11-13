/** Face ID login challenge DTO (POST /auth/login when face_required). */
export type FaceLoginChallengeDto = {
  token: string;
  expires_at: string;
  directions: string[];
  directions_count: 4 | 8;
  channel: "webcam" | "qr_phone";
  bridge_path: string;
  bridge_url: string;
  has_reference: boolean;
  status: "pending" | "approved" | "rejected" | "expired";
};

export type FaceLoginGateResponse = {
  face_required: true;
  face_challenge: FaceLoginChallengeDto;
  user: {
    id: number;
    name: string;
    login: string;
    role: string;
    tenantId: number;
    must_change_password?: boolean;
  };
};

export function isFaceLoginGateResponse(data: unknown): data is FaceLoginGateResponse {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.face_required === true &&
    o.face_challenge != null &&
    typeof o.face_challenge === "object" &&
    typeof (o.face_challenge as { token?: unknown }).token === "string"
  );
}

export const LIVENESS_LABELS: Record<string, string> = {
  left: "Влево",
  right: "Вправо",
  up: "Вверх",
  down: "Вниз",
  "up-left": "Вверх-влево",
  "up-right": "Вверх-вправо",
  "down-left": "Вниз-влево",
  "down-right": "Вниз-вправо"
};

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

export function stripTrailingSlash(origin: string): string {
  return origin.replace(/\/$/, "");
}

/** Env: telefon/QR uchun ochiq base (LAN yoki public). */
export function configuredFaceBridgeOrigin(): string | null {
  const raw =
    process.env.NEXT_PUBLIC_FACE_BRIDGE_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    if (!u.hostname) return null;
    return stripTrailingSlash(u.origin);
  } catch {
    return null;
  }
}

export function buildAbsoluteBridgeUrl(bridgePath: string, origin: string): string {
  const path = bridgePath.startsWith("/") ? bridgePath : `/${bridgePath}`;
  return `${stripTrailingSlash(origin)}${path}`;
}

/**
 * QR / «Скопировать ссылку» uchun ochiladigan origin.
 * Prefer: NEXT_PUBLIC_FACE_BRIDGE_ORIGIN | NEXT_PUBLIC_APP_URL →
 * loopback bo‘lsa /api/face-bridge-origin (LAN) → window.location.origin.
 */
export async function resolveFaceBridgeOrigin(): Promise<string> {
  const fromEnv = configuredFaceBridgeOrigin();
  if (fromEnv && !isLoopbackHostname(new URL(fromEnv).hostname)) return fromEnv;
  if (fromEnv && typeof window === "undefined") return fromEnv;

  if (typeof window === "undefined") return fromEnv ?? "";

  const { hostname, origin, port, protocol } = window.location;
  if (!isLoopbackHostname(hostname)) return origin;

  try {
    const res = await fetch("/api/face-bridge-origin", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { origin?: string | null };
      if (typeof data.origin === "string" && data.origin.startsWith("http")) {
        return stripTrailingSlash(data.origin);
      }
    }
  } catch {
    /* LAN aniqlanmasa — loopback (faqat shu qurilma) */
  }

  if (fromEnv) return fromEnv;
  /* Portni saqlab qolamiz (dev 3000). */
  const p = port || (protocol === "https:" ? "443" : "3000");
  return stripTrailingSlash(`${protocol}//${hostname}${p ? `:${p}` : ""}`);
}

/** @deprecated Prefer resolveFaceBridgeOrigin + buildAbsoluteBridgeUrl for phone QR. */
export function absoluteBridgeUrl(challenge: FaceLoginChallengeDto): string {
  if (typeof window !== "undefined" && !isLoopbackHostname(window.location.hostname)) {
    return buildAbsoluteBridgeUrl(challenge.bridge_path, window.location.origin);
  }
  if (challenge.bridge_url.startsWith("http")) {
    try {
      const u = new URL(challenge.bridge_url);
      if (!isLoopbackHostname(u.hostname)) return challenge.bridge_url;
    } catch {
      /* fall through */
    }
  }
  if (typeof window === "undefined") return challenge.bridge_path;
  return buildAbsoluteBridgeUrl(challenge.bridge_path, window.location.origin);
}
