import { createHash } from "crypto";
import { Readable } from "stream";
import { prisma } from "../../config/database";
import { storagePut } from "../../lib/storage.service";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";
import { loadActiveWorkSlotsByUserIds } from "../work-slots/work-slots.query.read";
import { buildFaceDescriptor } from "./face-match.descriptor";
import { decideFaceMatch, faceMatchScore } from "./face-match.pure";
import { getFaceReferenceMeta, loadOrBuildReferenceDescriptor } from "./mobile-face.reference";
import {
  MAX_IMAGE_BYTES,
  REF_KEY,
  decodeBase64Image,
  facePolicyFromMobileConfig,
  matchThreshold,
  readUiPrefs,
  storagePrefix,
  workRegionDateString,
  isOrderSubmitFaceCheckpoint,
  type FaceVerifyContext
} from "./mobile-face.shared";

export type { FaceVerifyContext, FaceVerificationPolicy } from "./mobile-face.shared";
export { facePolicyFromMobileConfig, workRegionDateString, isOrderSubmitFaceCheckpoint } from "./mobile-face.shared";
export {
  deleteFaceReference,
  getFaceReferenceKey,
  getFaceReferenceMeta,
  readFaceReferenceBuffer,
  uploadFaceReference
} from "./mobile-face.reference";

function hashSeed(userId: number, dateStr: string): number {
  const h = createHash("sha256").update(`${userId}:${dateStr}:face-checkpoints`).digest();
  return h.readUInt32BE(0);
}

/** Kunlik random buyurtma checkpointlari (1..30 oralig‘ida, max 5 ta). */
export function pickDailyOrderCheckpoints(userId: number, dateStr: string, max: number): number[] {
  if (max <= 0) return [];
  let seed = hashSeed(userId, dateStr);
  const set = new Set<number>();
  let guard = 0;
  while (set.size < max && guard++ < 200) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    set.add((seed % 30) + 1);
  }
  return [...set].sort((a, b) => a - b);
}

export async function getOrCreateDailyState(
  tenantId: number,
  userId: number,
  dateStr: string,
  maxCheckpoints = 5
) {
  const workDate = new Date(`${dateStr}T00:00:00.000Z`);
  let row = await prisma.faceVerificationDailyState.findUnique({
    where: {
      tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate }
    }
  });
  if (row) return row;
  const checkpoints = pickDailyOrderCheckpoints(userId, dateStr, maxCheckpoints);
  row = await prisma.faceVerificationDailyState.create({
    data: {
      tenant_id: tenantId,
      user_id: userId,
      work_date: workDate,
      checkpoint_order_nos: checkpoints
    }
  });
  return row;
}

export async function getFaceVerificationStatus(
  tenantId: number,
  userId: number,
  mobileConfig: AgentMobileConfigV1 | undefined
) {
  const policy = facePolicyFromMobileConfig(mobileConfig);
  const ref = await getFaceReferenceMeta(tenantId, userId);
  const dateStr = workRegionDateString();
  const daily = policy.enabled
    ? await getOrCreateDailyState(tenantId, userId, dateStr, policy.maxRandomOrdersPerDay)
    : null;

  return {
    policy,
    has_reference: ref.has_reference,
    reference_uploaded_at: ref.uploaded_at,
    needs_daily_login:
      policy.enabled &&
      policy.dailyLogin &&
      daily != null &&
      !daily.daily_login_verified,
    order_checkpoints_today: (daily?.checkpoint_order_nos as number[]) ?? [],
    order_verify_count_today: daily?.order_verify_count ?? 0,
    order_action_count_today: daily?.order_action_count ?? 0,
    match_threshold: matchThreshold()
  };
}

export async function checkFaceVerificationRequired(
  tenantId: number,
  userId: number,
  context: FaceVerifyContext,
  mobileConfig: AgentMobileConfigV1 | undefined,
  opts?: { order_id?: number; client_id?: number }
): Promise<{ required: boolean; reason?: string }> {
  const policy = facePolicyFromMobileConfig(mobileConfig);
  if (!policy.enabled) return { required: false };

  const ref = await getFaceReferenceMeta(tenantId, userId);
  if (!ref.has_reference) {
    return { required: true, reason: "reference_missing" };
  }

  const dateStr = workRegionDateString();
  const daily = await getOrCreateDailyState(
    tenantId,
    userId,
    dateStr,
    policy.maxRandomOrdersPerDay
  );

  if (context === "daily_login") {
    if (!policy.dailyLogin) return { required: false };
    return daily.daily_login_verified
      ? { required: false }
      : { required: true, reason: "daily_login" };
  }

  if (context === "order_submit") {
    // Side-effect yo‘q: count faqat buyurtma yaratilgach bump qilinadi (face gate + bumpOrderFaceActionCount).
    if (
      !isOrderSubmitFaceCheckpoint({
        orderActionCount: daily.order_action_count,
        orderVerifyCount: daily.order_verify_count,
        maxRandomOrdersPerDay: policy.maxRandomOrdersPerDay,
        checkpoints: (daily.checkpoint_order_nos as number[]) ?? []
      })
    ) {
      return { required: false };
    }
    return { required: true, reason: "random_order" };
  }

  if (context === "territory_check") {
    if (!policy.territoryCheck) return { required: false };
    return { required: true, reason: "territory_check" };
  }

  if (context === "delivery_confirm" || context === "payment_accept") {
    return { required: true, reason: context };
  }

  void opts;
  return { required: false };
}

export async function submitFaceVerification(
  tenantId: number,
  userId: number,
  input: {
    context: FaceVerifyContext;
    image_base64: string;
    order_id?: number;
    client_id?: number;
  }
) {
  const { buf, contentType } = decodeBase64Image(input.image_base64);
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { ui_preferences: true }
  });
  if (!u) throw new Error("NOT_FOUND");
  const prefs = readUiPrefs(u.ui_preferences);
  const refKey = typeof prefs[REF_KEY] === "string" ? (prefs[REF_KEY] as string) : null;
  if (!refKey) throw new Error("REFERENCE_MISSING");

  let probeDesc: number[];
  try {
    probeDesc = await buildFaceDescriptor(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FACE_IMAGE_BLANK") throw new Error("FACE_IMAGE_BLANK");
    throw e;
  }

  const refDesc = await loadOrBuildReferenceDescriptor(tenantId, userId, prefs, probeDesc.length);
  if (!refDesc) throw new Error("REFERENCE_MISSING");

  const threshold = matchThreshold();
  const score = faceMatchScore(refDesc, probeDesc);
  const status = decideFaceMatch(score, threshold);

  const ext = contentType.includes("png") ? "png" : "jpg";
  const ts = Date.now();
  const filename = `verify-${input.context}-${ts}.${ext}`;
  const put = await storagePut(
    storagePrefix(tenantId, userId),
    filename,
    Readable.from(buf),
    contentType,
    MAX_IMAGE_BYTES
  );

  const slotMap = await loadActiveWorkSlotsByUserIds([userId]);
  const workSlotId = slotMap.get(userId)?.slot_id ?? null;

  const log = await prisma.faceVerificationLog.create({
    data: {
      tenant_id: tenantId,
      user_id: userId,
      work_slot_id: workSlotId,
      context: input.context,
      snapshot_storage_key: put.key,
      reference_storage_key: refKey,
      order_id: input.order_id ?? null,
      client_id: input.client_id ?? null,
      status,
      meta: {
        auto: true,
        score,
        threshold,
        matched_user_id: userId
      }
    }
  });

  if (status === "rejected") {
    return {
      ok: false as const,
      log_id: log.id,
      status,
      score,
      threshold,
      verified_at: log.created_at.toISOString()
    };
  }

  const dateStr = workRegionDateString();
  const daily = await getOrCreateDailyState(tenantId, userId, dateStr, 5);
  const dailyPatch: {
    daily_login_verified?: boolean;
    order_verify_count?: number;
  } = {};

  if (input.context === "daily_login") {
    dailyPatch.daily_login_verified = true;
  }
  if (input.context === "order_submit") {
    dailyPatch.order_verify_count = daily.order_verify_count + 1;
  }

  if (Object.keys(dailyPatch).length > 0) {
    await prisma.faceVerificationDailyState.update({
      where: { id: daily.id },
      data: dailyPatch
    });
  }

  return {
    ok: true as const,
    log_id: log.id,
    status,
    score,
    threshold,
    verified_at: log.created_at.toISOString()
  };
}
