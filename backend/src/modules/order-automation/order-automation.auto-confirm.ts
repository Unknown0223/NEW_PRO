import { prisma } from "../../config/database";
import {
  autoConfirmRuleMatchesContext,
  computeAutoConfirmRunAt
} from "./order-automation.engine";
import type { OrderRuleContext } from "./order-automation.types";
import { enqueueOrderAutoConfirmJob } from "./order-automation.jobs";

export async function planAutoConfirmForOrder(
  tenantId: number,
  orderId: number,
  ctx: OrderRuleContext,
  orderCreatedAt: Date
): Promise<void> {
  const rules = await prisma.orderAutoConfirmRule.findMany({
    where: { tenant_id: tenantId, is_active: true },
    orderBy: { id: "asc" }
  });
  for (const rule of rules) {
    if (!autoConfirmRuleMatchesContext(rule, ctx)) continue;
    const runAt = computeAutoConfirmRunAt(rule, orderCreatedAt);
    const schedule = await prisma.orderAutoConfirmSchedule.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        rule_id: rule.id,
        run_at: runAt,
        status: "pending"
      }
    });
    const delayMs = Math.max(0, runAt.getTime() - Date.now());
    if (rule.execution_type === "instant" || delayMs < 2000) {
      await enqueueOrderAutoConfirmJob(
        { tenant_id: tenantId, schedule_id: schedule.id },
        0
      );
    } else {
      await enqueueOrderAutoConfirmJob(
        { tenant_id: tenantId, schedule_id: schedule.id },
        delayMs
      );
    }
  }
}

export async function executeAutoConfirmSchedule(
  tenantId: number,
  scheduleId: number
): Promise<void> {
  const schedule = await prisma.orderAutoConfirmSchedule.findFirst({
    where: { tenant_id: tenantId, id: scheduleId },
    include: { order: true, rule: true }
  });
  if (!schedule || schedule.status !== "pending") return;
  const order = schedule.order;
  if (order.status !== "new") {
    await prisma.orderAutoConfirmSchedule.update({
      where: { id: scheduleId },
      data: { status: "cancelled", last_error: `Order status is ${order.status}` }
    });
    return;
  }
  try {
    const { updateOrderStatus } = await import("../orders/domain/order.lifecycle");
    const admin = await prisma.user.findFirst({
      where: { tenant_id: tenantId, role: "admin", is_active: true },
      select: { id: true },
      orderBy: { id: "asc" }
    });
    await updateOrderStatus(tenantId, order.id, "confirmed", admin?.id ?? null, "admin");
    await prisma.orderAutoConfirmSchedule.update({
      where: { id: scheduleId },
      data: { status: "done", last_error: null }
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.orderAutoConfirmSchedule.update({
      where: { id: scheduleId },
      data: { status: "failed", last_error: msg.slice(0, 500) }
    });
  }
}
