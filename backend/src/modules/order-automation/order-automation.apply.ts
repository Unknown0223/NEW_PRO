import { prisma } from "../../config/database";
import type { CreateOrderInput } from "../orders/domain/order.types";
import { normalizeOrderType } from "../orders/order-status";
import { planAutoConfirmForOrder } from "./order-automation.auto-confirm";
import { buildOrderRuleContextFromParts } from "./order-automation.engine";
import { assertOrderNotRestricted } from "./order-automation.restrict";
import type { SourceChannel } from "./order-automation.types";

export type CreateOrderRulePreview = {
  client: {
    region: string | null;
    city: string | null;
    zone: string | null;
    district: string | null;
    neighborhood: string | null;
  };
  agent_trade_direction: string | null;
  total_sum: number;
  creation_channel?: SourceChannel;
};

export async function buildRuleContextForCreate(
  tenantId: number,
  input: CreateOrderInput,
  preview: CreateOrderRulePreview
): Promise<import("./order-automation.types").OrderRuleContext> {
  const territoryRefs: string[] = [];
  for (const v of [
    preview.client.region,
    preview.client.city,
    preview.client.district,
    preview.client.neighborhood
  ]) {
    if (v?.trim()) territoryRefs.push(v.trim());
  }
  let agentTrade: string | null = preview.agent_trade_direction;
  if (input.agent_id) {
    const agent = await prisma.user.findFirst({
      where: { tenant_id: tenantId, id: input.agent_id },
      select: {
        trade_direction: true,
        trade_direction_row: { select: { name: true, code: true } }
      }
    });
    agentTrade =
      agent?.trade_direction_row?.name ??
      agent?.trade_direction_row?.code ??
      agent?.trade_direction ??
      agentTrade;
  }
  return buildOrderRuleContextFromParts({
    tenant_id: tenantId,
    total_sum: preview.total_sum,
    currency_code: "UZS",
    warehouse_id: input.warehouse_id,
    agent_id: input.agent_id ?? null,
    agent_trade_direction: agentTrade,
    payment_method_ref: input.payment_method_ref ?? null,
    request_type_ref: input.request_type_ref ?? null,
    is_consignment: input.is_consignment ?? false,
    order_type: normalizeOrderType(input.order_type),
    creation_channel: preview.creation_channel ?? "web",
    client_region: preview.client.region,
    client_city: preview.client.city,
    client_zone: preview.client.zone,
    client_territory_refs: territoryRefs
  });
}

export async function applyOrderAutomationOnCreate(
  tenantId: number,
  orderId: number,
  input: CreateOrderInput,
  preview: CreateOrderRulePreview,
  orderCreatedAt: Date
): Promise<void> {
  const ctx = await buildRuleContextForCreate(tenantId, input, preview);
  await assertOrderNotRestricted(tenantId, ctx);
  await planAutoConfirmForOrder(tenantId, orderId, ctx, orderCreatedAt);
}

/** Tranzaksiyadan oldin — faqat restriction. */
export async function assertCreateOrderNotRestricted(
  tenantId: number,
  input: CreateOrderInput,
  preview: CreateOrderRulePreview
): Promise<void> {
  const ctx = await buildRuleContextForCreate(tenantId, input, preview);
  await assertOrderNotRestricted(tenantId, ctx);
}

/** Tranzaksiyadan keyin — auto-confirm reja. */
export async function planAutoConfirmAfterCreate(
  tenantId: number,
  orderId: number,
  input: CreateOrderInput,
  preview: CreateOrderRulePreview,
  orderCreatedAt: Date
): Promise<void> {
  const ctx = await buildRuleContextForCreate(tenantId, input, preview);
  await planAutoConfirmForOrder(tenantId, orderId, ctx, orderCreatedAt);
}
