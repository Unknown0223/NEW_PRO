/** AI Assistant — audit yozuvi (har savol / preview / confirm / export). */
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import type { AiActor, AiDenied } from "./ai.types";

export type AiAuditAction = "ask" | "preview" | "confirm" | "export" | "denied";

export type AiAuditInput = {
  actor: AiActor;
  action: AiAuditAction;
  intent?: string;
  tools?: string[];
  denied?: AiDenied[];
  rows?: number;
  status?: string;
  entityId?: string | number;
  detail?: Record<string, unknown>;
};

/**
 * Audit yozuvi hech qachon asosiy oqimni to‘xtatmaydi.
 * `appendTenantAuditEvent` ichida parol/token/PINFL kabi maydonlar redacted bo‘ladi.
 */
export async function auditAi(input: AiAuditInput): Promise<void> {
  try {
    await appendTenantAuditEvent({
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.userId,
      entityType: "ai_assistant",
      entityId: input.entityId ?? input.actor.userId ?? "anonymous",
      action: `ai.${input.action}`,
      payload: {
        intent: input.intent,
        tools: input.tools?.slice(0, 8),
        denied: input.denied?.map((item) => item.tool).slice(0, 8),
        rows: input.rows,
        status: input.status,
        role: input.actor.role,
        ...input.detail
      }
    });
  } catch {
    // audit xatosi foydalanuvchi javobini buzmaydi
  }
}
