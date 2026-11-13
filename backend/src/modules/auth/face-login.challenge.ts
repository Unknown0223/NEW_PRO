import { prisma } from "../../config/database";
import { getFaceReferenceMeta } from "../mobile/mobile-face.service";
import { normalizeFullTabelSettings } from "../tabel/tabel-settings.pure";
import { toFio } from "../staff/staff.shared.helpers";
import {
  FACE_LOGIN_RECREATE_WINDOW_MS,
  FACE_LOGIN_TTL_MS,
  faceBridgePath,
  hashFaceChallengeToken,
  newFaceChallengeToken,
  pickLivenessDirections,
  resolveChallengeLifecycle,
  resolveFaceBridgePublicOrigin,
  type FaceLoginChannel
} from "./face-login.pure";

export type ChallengeMeta = {
  device_id?: string | null;
  device_name?: string | null;
  user_agent?: string | null;
  apk_version?: string | null;
  ip_address?: string | null;
  request_origin?: string | null;
  directions_count?: 4 | 8;
  session_issued?: boolean;
  /** Birinchi challenge yaratilgan vaqt (ISO) — recreate oynasi shu bilan. */
  login_started_at?: string | null;
};

export async function loadFaceAntifraud(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const root =
    tenant?.settings != null && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? (tenant.settings as Record<string, unknown>)
      : {};
  return normalizeFullTabelSettings(root.tabel_settings).faceAntifraud;
}

export async function createFaceLoginChallenge(input: {
  tenantId: number;
  tenantSlug: string;
  user: {
    id: number;
    name: string;
    login: string;
    role: string;
    first_name?: string | null;
    last_name?: string | null;
    middle_name?: string | null;
    code?: string | null;
    app_access?: boolean;
    must_change_password?: boolean;
  };
  meta: ChallengeMeta;
  publicOrigin?: string | null;
  headers?: {
    origin?: string | string[];
    "x-forwarded-proto"?: string | string[];
    "x-forwarded-host"?: string | string[];
    host?: string | string[];
  };
}) {
  const fa = await loadFaceAntifraud(input.tenantId);
  const directionsCount: 4 | 8 = fa.livenessDirections === 8 ? 8 : 4;
  const directions = pickLivenessDirections(directionsCount);
  const rawToken = newFaceChallengeToken();
  const tokenHash = hashFaceChallengeToken(rawToken);
  const expiresAt = new Date(Date.now() + FACE_LOGIN_TTL_MS);
  const ref = await getFaceReferenceMeta(input.tenantId, input.user.id);

  const loginStartedAt =
    typeof input.meta.login_started_at === "string" && input.meta.login_started_at
      ? input.meta.login_started_at
      : new Date().toISOString();

  await prisma.faceLoginChallenge.create({
    data: {
      tenant_id: input.tenantId,
      user_id: input.user.id,
      token_hash: tokenHash,
      status: "pending",
      channel: "webcam",
      directions,
      expires_at: expiresAt,
      meta: {
        ...input.meta,
        directions_count: directionsCount,
        has_reference: ref.has_reference,
        login_started_at: loginStartedAt
      }
    }
  });

  const bridgePath = faceBridgePath(rawToken);
  const origin = resolveFaceBridgePublicOrigin({
    publicOrigin: input.publicOrigin,
    headers: input.headers
  });
  return {
    face_required: true as const,
    face_challenge: {
      token: rawToken,
      expires_at: expiresAt.toISOString(),
      directions,
      directions_count: directionsCount,
      channel: "webcam" as FaceLoginChannel,
      bridge_path: bridgePath,
      bridge_url: origin ? `${origin}${bridgePath}` : bridgePath,
      has_reference: ref.has_reference,
      status: "pending" as const
    },
    user: {
      id: input.user.id,
      name: toFio({
        name: input.user.name,
        first_name: input.user.first_name ?? null,
        last_name: input.user.last_name ?? null,
        middle_name: input.user.middle_name ?? null
      }),
      login: input.user.login,
      role: input.user.role,
      tenantId: input.tenantId,
      code: input.user.code ?? null,
      app_access: input.user.app_access ?? true,
      must_change_password: input.user.must_change_password === true
    }
  };
}

export async function loadPendingChallenge(rawToken: string) {
  const tokenHash = hashFaceChallengeToken(rawToken);
  const row = await prisma.faceLoginChallenge.findUnique({
    where: { token_hash: tokenHash },
    include: {
      user: true,
      tenant: { select: { id: true, slug: true, is_active: true, settings: true } }
    }
  });
  if (!row) throw new Error("FACE_CHALLENGE_NOT_FOUND");
  const life = resolveChallengeLifecycle({
    status: row.status,
    expiresAtMs: row.expires_at.getTime(),
    nowMs: Date.now()
  });
  if (life === "expired" && row.status === "pending") {
    await prisma.faceLoginChallenge.update({
      where: { id: row.id },
      data: { status: "expired" }
    });
  }
  return { row, life, tokenHash };
}

/** Pending/expired/rejected → yangi token (parolsiz). Approved emas. */
export async function recreateFaceLoginChallenge(input: {
  challenge_token: string;
  publicOrigin?: string | null;
  headers?: {
    origin?: string | string[];
    "x-forwarded-proto"?: string | string[];
    "x-forwarded-host"?: string | string[];
    host?: string | string[];
  };
}) {
  const { row, life } = await loadPendingChallenge(input.challenge_token);
  if (life === "approved") throw new Error("FACE_CHALLENGE_ALREADY_USED");

  const metaRaw =
    row.meta != null && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as ChallengeMeta)
      : {};
  const startedMs = (() => {
    if (typeof metaRaw.login_started_at === "string" && metaRaw.login_started_at) {
      const t = Date.parse(metaRaw.login_started_at);
      if (Number.isFinite(t)) return t;
    }
    return row.created_at.getTime();
  })();
  if (Date.now() - startedMs > FACE_LOGIN_RECREATE_WINDOW_MS) {
    throw new Error("FACE_CHALLENGE_EXPIRED");
  }

  if (row.status === "pending") {
    await prisma.faceLoginChallenge.update({
      where: { id: row.id },
      data: { status: "expired" }
    });
  }

  return createFaceLoginChallenge({
    tenantId: row.tenant_id,
    tenantSlug: row.tenant.slug,
    user: row.user,
    meta: {
      device_id: metaRaw.device_id ?? null,
      device_name: metaRaw.device_name ?? null,
      user_agent: metaRaw.user_agent ?? null,
      apk_version: metaRaw.apk_version ?? null,
      ip_address: metaRaw.ip_address ?? null,
      request_origin: metaRaw.request_origin ?? null,
      login_started_at: metaRaw.login_started_at ?? row.created_at.toISOString()
    },
    publicOrigin: input.publicOrigin ?? metaRaw.request_origin ?? null,
    headers: input.headers
  });
}

export async function getFaceLoginStatus(rawToken: string) {
  const { row, life } = await loadPendingChallenge(rawToken);
  const ref = await getFaceReferenceMeta(row.tenant_id, row.user_id);
  return {
    status: life,
    expires_at: row.expires_at.toISOString(),
    channel: row.channel,
    directions: row.directions,
    user_id: row.user_id,
    tenant_slug: row.tenant.slug,
    has_reference: ref.has_reference
  };
}
