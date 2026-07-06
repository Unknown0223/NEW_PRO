/** To'lov domain eventlari — nomlar va payload turlari. */

export const PAYMENT_EVENT_CHANNEL = "payment-events" as const;

export const PaymentEventNames = {
  CREATED: "payment.created",
  VOIDED: "payment.voided",
  ALLOCATED: "payment.allocated"
} as const;

export type PaymentEventName = (typeof PaymentEventNames)[keyof typeof PaymentEventNames];

export type PaymentCreatedPayload = {
  type: typeof PaymentEventNames.CREATED;
  tenant_id: number;
  payment_id: number;
  client_id: number;
};

export type PaymentVoidedPayload = {
  type: typeof PaymentEventNames.VOIDED;
  tenant_id: number;
  payment_id: number;
  client_id: number;
};

export type PaymentAllocatedPayload = {
  type: typeof PaymentEventNames.ALLOCATED;
  tenant_id: number;
  payment_id: number;
  order_id: number;
};

export type PaymentEventPayload = PaymentCreatedPayload | PaymentVoidedPayload | PaymentAllocatedPayload;

export function isPaymentCreatedPayload(payload: unknown): payload is PaymentCreatedPayload {
  if (payload == null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === PaymentEventNames.CREATED &&
    typeof p.tenant_id === "number" &&
    typeof p.payment_id === "number" &&
    typeof p.client_id === "number"
  );
}

export function isPaymentVoidedPayload(payload: unknown): payload is PaymentVoidedPayload {
  if (payload == null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === PaymentEventNames.VOIDED &&
    typeof p.tenant_id === "number" &&
    typeof p.payment_id === "number" &&
    typeof p.client_id === "number"
  );
}

export function createPaymentCreatedPayload(
  tenantId: number,
  paymentId: number,
  clientId: number
): PaymentCreatedPayload {
  return {
    type: PaymentEventNames.CREATED,
    tenant_id: tenantId,
    payment_id: paymentId,
    client_id: clientId
  };
}

export function createPaymentVoidedPayload(
  tenantId: number,
  paymentId: number,
  clientId: number
): PaymentVoidedPayload {
  return {
    type: PaymentEventNames.VOIDED,
    tenant_id: tenantId,
    payment_id: paymentId,
    client_id: clientId
  };
}
