/** Buyurtma domain eventlari — nomlar va payload turlari. */

export const ORDER_EVENT_CHANNEL = "order-events" as const;

export const OrderEventNames = {
  UPDATED: "order.updated"
} as const;

export type OrderEventName = (typeof OrderEventNames)[keyof typeof OrderEventNames];

export type OrderUpdatedPayload = {
  type: typeof OrderEventNames.UPDATED;
  tenant_id: number;
  order_id: number;
};

export type OrderEventPayload = OrderUpdatedPayload;

export function isOrderUpdatedPayload(payload: unknown): payload is OrderUpdatedPayload {
  if (payload == null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === OrderEventNames.UPDATED &&
    typeof p.tenant_id === "number" &&
    typeof p.order_id === "number"
  );
}

export function createOrderUpdatedPayload(tenantId: number, orderId: number): OrderUpdatedPayload {
  return {
    type: OrderEventNames.UPDATED,
    tenant_id: tenantId,
    order_id: orderId
  };
}
