/** Mijoz domain eventlari — nomlar va payload turlari. */

export const CLIENT_EVENT_CHANNEL = "client-events" as const;

export const ClientEventNames = {
  CREATED: "client.created",
  UPDATED: "client.updated",
  MERGED: "client.merged"
} as const;

export type ClientEventName = (typeof ClientEventNames)[keyof typeof ClientEventNames];

export type ClientCreatedPayload = {
  type: typeof ClientEventNames.CREATED;
  tenant_id: number;
  client_id: number;
};

export type ClientUpdatedPayload = {
  type: typeof ClientEventNames.UPDATED;
  tenant_id: number;
  client_id: number;
};

export type ClientMergedPayload = {
  type: typeof ClientEventNames.MERGED;
  tenant_id: number;
  source_client_id: number;
  target_client_id: number;
};

export type ClientEventPayload = ClientCreatedPayload | ClientUpdatedPayload | ClientMergedPayload;

export function isClientCreatedPayload(payload: unknown): payload is ClientCreatedPayload {
  if (payload == null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === ClientEventNames.CREATED &&
    typeof p.tenant_id === "number" &&
    typeof p.client_id === "number"
  );
}

export function isClientMergedPayload(payload: unknown): payload is ClientMergedPayload {
  if (payload == null || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    p.type === ClientEventNames.MERGED &&
    typeof p.tenant_id === "number" &&
    typeof p.source_client_id === "number" &&
    typeof p.target_client_id === "number"
  );
}

export function createClientCreatedPayload(tenantId: number, clientId: number): ClientCreatedPayload {
  return {
    type: ClientEventNames.CREATED,
    tenant_id: tenantId,
    client_id: clientId
  };
}
