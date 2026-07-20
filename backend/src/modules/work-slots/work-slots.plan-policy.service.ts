import { prisma } from "../../config/database";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_SLOT_PLAN_POLICY,
  isSlotPlanPolicy,
  patchSlotPlanPolicyIntoSettings,
  readSlotPlanPolicy,
  SLOT_PLAN_POLICIES,
  type SlotPlanPolicy
} from "./work-slots.plan-policy";

export async function getWorkSlotPlanPolicy(tenantId: number): Promise<{
  plan_policy: SlotPlanPolicy;
  allowed: readonly SlotPlanPolicy[];
  default: SlotPlanPolicy;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) throw new Error("NOT_FOUND");
  return {
    plan_policy: readSlotPlanPolicy(tenant.settings),
    allowed: SLOT_PLAN_POLICIES,
    default: DEFAULT_SLOT_PLAN_POLICY
  };
}

export async function setWorkSlotPlanPolicy(
  tenantId: number,
  plan_policy: string
): Promise<{ plan_policy: SlotPlanPolicy }> {
  if (!isSlotPlanPolicy(plan_policy)) throw new Error("BAD_PLAN_POLICY");
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!tenant) throw new Error("NOT_FOUND");
  const next = patchSlotPlanPolicyIntoSettings(tenant.settings, plan_policy);
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: next as Prisma.InputJsonValue }
  });
  return { plan_policy };
}
