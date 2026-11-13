import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { tenantIdFrom } from "../../domain/tenant-id";
import { validateLivenessSteps } from "../tabel/tabel-antifraud.pure";
import { normalizeFullTabelSettings } from "../tabel/tabel-settings.pure";
import { getFaceReferenceMeta, submitFaceVerification } from "../mobile/mobile-face.service";
import {
  FACE_LOGIN_CONTEXT,
  shouldChallengeFaceLogin,
  type FaceLoginChannel
} from "./face-login.pure";
import { loginAfterFaceApproved } from "./auth.login-session";
import {
  type ChallengeMeta,
  loadFaceAntifraud,
  loadPendingChallenge
} from "./face-login.challenge";

export {
  createFaceLoginChallenge,
  getFaceLoginStatus,
  recreateFaceLoginChallenge
} from "./face-login.challenge";

export async function userNeedsFaceLogin(tenantId: number, userId: number): Promise<boolean> {
  const [user, fa] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { require_face_login: true, role: true }
    }),
    loadFaceAntifraud(tenantId)
  ]);
  if (!user) return false;
  const ref = await getFaceReferenceMeta(tenantId, userId);
  /** Etalon yo‘q yoki toggle o‘chiq — oddiy login/parol, Face ID so‘ralmaydi. */
  return shouldChallengeFaceLogin({
    userRequireFaceLogin: user.require_face_login === true,
    tenantRequireFaceLogin: fa.requireFaceLogin === true,
    role: user.role,
    hasReference: ref.has_reference === true
  });
}

function metaObject(meta: unknown): Record<string, unknown> {
  if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

export async function verifyFaceLoginChallenge(
  app: FastifyInstance,
  input: {
    challenge_token: string;
    image_base64: string;
    liveness_steps: unknown;
    channel?: FaceLoginChannel;
    landmarks?: Array<{ x: number; y: number }> | null;
  }
) {
  const { row, life } = await loadPendingChallenge(input.challenge_token);
  if (life !== "pending") {
    if (life === "approved") throw new Error("FACE_CHALLENGE_ALREADY_USED");
    if (life === "rejected") throw new Error("FACE_CHALLENGE_REJECTED");
    throw new Error("FACE_CHALLENGE_EXPIRED");
  }

  const fa = normalizeFullTabelSettings(
    row.tenant.settings != null &&
      typeof row.tenant.settings === "object" &&
      !Array.isArray(row.tenant.settings)
      ? (row.tenant.settings as Record<string, unknown>).tabel_settings
      : undefined
  ).faceAntifraud;
  const requiredCount: 4 | 8 = fa.livenessDirections === 8 ? 8 : 4;
  const liveness = validateLivenessSteps(input.liveness_steps, requiredCount);
  if (!liveness.ok) {
    await prisma.faceLoginChallenge.update({
      where: { id: row.id },
      data: {
        status: "rejected",
        used_at: new Date(),
        channel: input.channel ?? row.channel,
        meta: {
          ...metaObject(row.meta),
          reject_reason: liveness.reason ?? "LIVENESS_FAILED"
        }
      }
    });
    throw new Error("FACE_LIVENESS_FAILED");
  }

  const ref = await getFaceReferenceMeta(row.tenant_id, row.user_id);
  if (!ref.has_reference) throw new Error("REFERENCE_MISSING");

  let match: Awaited<ReturnType<typeof submitFaceVerification>>;
  try {
    match = await submitFaceVerification(row.tenant_id, row.user_id, {
      context: FACE_LOGIN_CONTEXT,
      image_base64: input.image_base64,
      landmarks: input.landmarks ?? null
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "REFERENCE_MISSING") throw new Error("REFERENCE_MISSING");
    if (msg === "FACE_IMAGE_BLANK" || msg === "FACE_NOT_DETECTED") throw e;
    throw e;
  }

  if (!match.ok) {
    const prevMeta = metaObject(row.meta);
    const attempts = Math.max(0, Number(prevMeta.mismatch_attempts ?? 0)) + 1;
    const maxAttempts = 3;
    const nextMeta = {
      ...prevMeta,
      mismatch_attempts: attempts,
      reject_reason: "FACE_MISMATCH",
      score: match.score,
      log_id: match.log_id
    };
    if (attempts >= maxAttempts) {
      await prisma.faceLoginChallenge.update({
        where: { id: row.id },
        data: {
          status: "rejected",
          used_at: new Date(),
          channel: input.channel ?? row.channel,
          meta: nextMeta
        }
      });
    } else {
      /* Soft fail — challenge stays pending so user can retake without new QR. */
      await prisma.faceLoginChallenge.update({
        where: { id: row.id },
        data: {
          channel: input.channel ?? row.channel,
          meta: nextMeta
        }
      });
    }
    throw new Error("FACE_MISMATCH");
  }

  const channel: FaceLoginChannel = input.channel ?? (row.channel as FaceLoginChannel) ?? "webcam";
  const prevMeta = metaObject(row.meta);
  const { reject_reason: _rejectReason, ...metaWithoutReject } = prevMeta;
  void _rejectReason;
  await prisma.faceLoginChallenge.update({
    where: { id: row.id },
    data: {
      status: "approved",
      used_at: new Date(),
      channel,
      meta: {
        ...metaWithoutReject,
        mismatch_attempts: prevMeta.mismatch_attempts ?? 0,
        score: match.score,
        log_id: match.log_id
      }
    }
  });

  /* QR telefon: faqat approve — desktop /complete orqali sessiya oladi. */
  if (channel === "qr_phone") {
    return { ok: true as const, status: "approved" as const, session_pending: true as const };
  }

  const tokens = await issueSessionForApprovedChallenge(app, row.id);
  return { ok: true as const, status: "approved" as const, ...tokens };
}

async function issueSessionForApprovedChallenge(app: FastifyInstance, challengeId: number) {
  const row = await prisma.faceLoginChallenge.findUnique({
    where: { id: challengeId },
    include: { user: true, tenant: true }
  });
  if (!row || row.status !== "approved") throw new Error("FACE_CHALLENGE_NOT_APPROVED");
  const meta =
    row.meta != null && typeof row.meta === "object" && !Array.isArray(row.meta)
      ? (row.meta as ChallengeMeta)
      : {};
  if (meta.session_issued === true) {
    throw new Error("FACE_CHALLENGE_ALREADY_USED");
  }

  const result = await loginAfterFaceApproved(app, {
    tenantId: tenantIdFrom(row.tenant_id),
    tenantSlug: row.tenant.slug,
    user: row.user,
    device_id: meta.device_id ?? null,
    device_name: meta.device_name ?? null,
    user_agent: meta.user_agent ?? null,
    apk_version: meta.apk_version ?? null,
    ip_address: meta.ip_address ?? null,
    request_origin: meta.request_origin ?? null
  });

  await prisma.faceLoginChallenge.update({
    where: { id: row.id },
    data: {
      meta: { ...meta, session_issued: true }
    }
  });

  return result;
}

export async function completeFaceLoginChallenge(app: FastifyInstance, rawToken: string) {
  const { row, life } = await loadPendingChallenge(rawToken);
  if (life === "pending") {
    return { status: "pending" as const };
  }
  if (life !== "approved") {
    if (life === "rejected") throw new Error("FACE_CHALLENGE_REJECTED");
    throw new Error("FACE_CHALLENGE_EXPIRED");
  }
  const tokens = await issueSessionForApprovedChallenge(app, row.id);
  return { status: "approved" as const, ...tokens };
}
