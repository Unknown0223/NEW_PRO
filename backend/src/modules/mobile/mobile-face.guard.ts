import { prisma } from "../../config/database";
import { resolveMobileConfigForUser } from "../staff/agent-mobile-config.defaults";
import type { AgentMobileConfigV1 } from "../staff/agent-mobile-config.types";
import { loadAgentMobileConfig } from "./mobile-agent-sync.config.service";
import {
  checkFaceVerificationRequired,
  facePolicyFromMobileConfig,
  getFaceReferenceMeta,
  getOrCreateDailyState,
  isOrderSubmitFaceCheckpoint,
  workRegionDateString,
  type FaceVerifyContext
} from "./mobile-face.service";

/** Tasdiqlangan verify oynasi (daqiqa) — client selfie → API oralig‘i */
export const FACE_GATE_MAX_AGE_MINUTES = 15;

export class FaceGateError extends Error {
  constructor(
    message: string,
    readonly code: "FACE_REQUIRED" | "FACE_DAILY_REQUIRED" | "FACE_REFERENCE_REQUIRED"
  ) {
    super(message);
    this.name = "FaceGateError";
  }
}

export function isFaceGateError(e: unknown): e is FaceGateError {
  return e instanceof FaceGateError;
}

export async function loadMobileConfigForFaceGate(
  tenantId: number,
  userId: number
): Promise<AgentMobileConfigV1 | undefined> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: { role: true }
  });
  if (!u) return undefined;
  const stored = await loadAgentMobileConfig(tenantId, userId);
  return resolveMobileConfigForUser(u.role, stored ? { mobile_config: stored } : {});
}

async function findRecentApprovedLog(
  tenantId: number,
  userId: number,
  contexts: FaceVerifyContext[],
  maxAgeMinutes = FACE_GATE_MAX_AGE_MINUTES
) {
  const since = new Date(Date.now() - maxAgeMinutes * 60_000);
  return prisma.faceVerificationLog.findFirst({
    where: {
      tenant_id: tenantId,
      user_id: userId,
      status: "approved",
      context: { in: contexts },
      created_at: { gte: since }
    },
    orderBy: { created_at: "desc" },
    select: { id: true, context: true, created_at: true }
  });
}

/** Side-effect yo‘q: buyurtma checkpoint kerakmi? */
export async function peekOrderSubmitFaceRequired(
  tenantId: number,
  userId: number,
  mobileConfig: AgentMobileConfigV1 | undefined
): Promise<boolean> {
  const policy = facePolicyFromMobileConfig(mobileConfig);
  if (!policy.enabled) return false;
  const ref = await getFaceReferenceMeta(tenantId, userId);
  if (!ref.has_reference) return true;
  const daily = await getOrCreateDailyState(
    tenantId,
    userId,
    workRegionDateString(),
    policy.maxRandomOrdersPerDay
  );
  if (daily.order_verify_count >= policy.maxRandomOrdersPerDay) return false;
  return isOrderSubmitFaceCheckpoint({
    orderActionCount: daily.order_action_count,
    orderVerifyCount: daily.order_verify_count,
    maxRandomOrdersPerDay: policy.maxRandomOrdersPerDay,
    checkpoints: (daily.checkpoint_order_nos as number[]) ?? []
  });
}

/**
 * Mutatsiya oldidan: face yoqilgan bo‘lsa, yangi approved log majburiy.
 * - daily_login: bugungi kunlik tasdiq
 * - payment_accept / delivery_confirm / territory_check: doim
 * - order_submit: faqat checkpoint (peek)
 */
export async function assertFaceGateForAction(
  tenantId: number,
  userId: number,
  context: FaceVerifyContext,
  mobileConfig: AgentMobileConfigV1 | undefined
): Promise<void> {
  const policy = facePolicyFromMobileConfig(mobileConfig);
  if (!policy.enabled) return;

  const ref = await getFaceReferenceMeta(tenantId, userId);
  if (!ref.has_reference) {
    throw new FaceGateError(
      "Нет эталонного фото лица — сначала загрузите селфи",
      "FACE_REFERENCE_REQUIRED"
    );
  }

  if (policy.dailyLogin) {
    const daily = await getOrCreateDailyState(
      tenantId,
      userId,
      workRegionDateString(),
      policy.maxRandomOrdersPerDay
    );
    if (!daily.daily_login_verified) {
      throw new FaceGateError(
        "Требуется ежедневное подтверждение лица",
        "FACE_DAILY_REQUIRED"
      );
    }
  }

  if (context === "order_submit") {
    const need = await peekOrderSubmitFaceRequired(tenantId, userId, mobileConfig);
    if (!need) return;
    const log = await findRecentApprovedLog(tenantId, userId, ["order_submit"]);
    if (!log) {
      throw new FaceGateError(
        "Для заказа требуется подтверждение лица через сервер",
        "FACE_REQUIRED"
      );
    }
    return;
  }

  const check = await checkFaceVerificationRequired(tenantId, userId, context, mobileConfig);
  if (!check.required) return;

  const log = await findRecentApprovedLog(tenantId, userId, [context]);
  if (!log) {
    throw new FaceGateError(
      "Требуется подтверждение лица через сервер",
      "FACE_REQUIRED"
    );
  }
}

export async function bumpOrderFaceActionCount(
  tenantId: number,
  userId: number,
  mobileConfig: AgentMobileConfigV1 | undefined
): Promise<void> {
  const policy = facePolicyFromMobileConfig(mobileConfig);
  if (!policy.enabled) return;
  const daily = await getOrCreateDailyState(
    tenantId,
    userId,
    workRegionDateString(),
    policy.maxRandomOrdersPerDay
  );
  await prisma.faceVerificationDailyState.update({
    where: { id: daily.id },
    data: { order_action_count: daily.order_action_count + 1 }
  });
}
