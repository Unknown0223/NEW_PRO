/** Qaytarishlar (returns) domain eventlari. */

export const RETURN_EVENT_CHANNEL = "return-events" as const;

export const ReturnEventNames = {
  CREATED: "return.created",
  STATUS_CHANGED: "return.status_changed"
} as const;

export type ReturnEventName = (typeof ReturnEventNames)[keyof typeof ReturnEventNames];

export type ReturnCreatedPayload = {
  type: typeof ReturnEventNames.CREATED;
  tenant_id: number;
  return_id: number;
};

export type ReturnStatusChangedPayload = {
  type: typeof ReturnEventNames.STATUS_CHANGED;
  tenant_id: number;
  return_id: number;
  status: string;
};

export type ReturnEventPayload = ReturnCreatedPayload | ReturnStatusChangedPayload;

export function createReturnCreatedPayload(tenantId: number, returnId: number): ReturnCreatedPayload {
  return {
    type: ReturnEventNames.CREATED,
    tenant_id: tenantId,
    return_id: returnId
  };
}
