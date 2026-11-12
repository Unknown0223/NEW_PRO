/** AI Assistant — tasdiqlash (confirm) qatori (2-etap: preview → execute). */
import type { FastifyInstance } from "fastify";
import { verifyToken, tokenBelongsTo } from "./ai.token";
import { claimOnce } from "./ai.store";
import { verifyParams } from "./ai.verify";
import { runTool } from "./ai.exec";
import { gateWrite, loadPermissionState } from "./ai.guard";
import { getTool } from "./ai.registry";
import { auditAi } from "./ai.audit";
import { answerFromRun } from "./ai.answer";
import type { AiActor, AiDenied } from "./ai.types";

export type ConfirmBody = { token: string };

function runDenied(reason: string, toolId: string): AiDenied {
  return { tool: toolId, reason };
}

export async function handleConfirm(
  app: FastifyInstance,
  actor: AiActor,
  body: unknown,
  now: number = Date.now()
): Promise<{ answer: unknown; denied: AiDenied[] }> {
  const denied: AiDenied[] = [];
  const tokenRaw = body && typeof body === "object" ? (body as ConfirmBody).token : undefined;
  const token = typeof tokenRaw === "string" ? tokenRaw : "";
  const verified = verifyToken(token, now);
  if (!verified.ok) {
    const error = verified.error === "expired" ? "Token muddati tugagan (yangi so‘rov yuboring)" : "Noto‘g‘ri token";
    auditAi({ actor, action: "confirm", status: "invalid_token", denied, detail: { error } });
    return { answer: { title: "Xatolik", lines: [error] }, denied };
  }
  const payload = verified.payload;
  if (payload.kind !== "confirm") {
    denied.push(runDenied("Token turi noto‘g‘ri", payload.tool));
    auditAi({ actor, action: "confirm", status: "wrong_kind", denied });
    return { answer: { title: "Xatolik", lines: ["Token turi noto‘g‘ri"] }, denied };
  }

  const state = await loadPermissionState(actor);
  const toolId = payload.tool;
  const tool = getTool(toolId);
  if (!tool) {
    denied.push(runDenied("Tool topilmadi", toolId));
    auditAi({ actor, action: "confirm", status: "unknown_tool", denied });
    return { answer: { title: "Xatolik", lines: ["Buyruq topilmadi"] }, denied };
  }

  if (!tokenBelongsTo(payload, actor.userId, actor.tenantId)) {
    denied.push(runDenied("Token boshqa foydalanuvchi/tenantga tegishli", toolId));
    auditAi({ actor, action: "confirm", status: "cross_owner", denied });
    return { answer: { title: "Xatolik", lines: ["Token sizga tegishli emas"] }, denied };
  }

  const ttlSec = Math.max(1, Math.floor((payload.exp - now) / 1000));
  const claimed = await claimOnce(payload.jti, ttlSec);
  if (!claimed) {
    denied.push(runDenied("Token allaqachon ishlatilgan (bir martalik)", toolId));
    auditAi({ actor, action: "confirm", status: "reused", denied });
    return { answer: { title: "Xatolik", lines: ["Token allaqachon ishlatilgan"] }, denied };
  }

  const allowedCheck = tool.kind === "write"
    ? gateWrite(tool, actor, state)
    : ({ allowed: true } as { allowed: boolean; reason?: string });
  if (!allowedCheck.allowed) {
    denied.push(runDenied(allowedCheck.reason ?? "Ruxsat yo‘q", toolId));
    auditAi({ actor, action: "confirm", intent: payload.tool, status: "denied", denied });
    return { answer: { title: "Ruxsat yo‘q", lines: [allowedCheck.reason ?? ""] }, denied };
  }

  const scopedParams = verifyParams(payload.params, tool.schema) ?? {};
  const run = await runTool(app, actor, tool, scopedParams);
  if (run.status === "denied") {
    denied.push(runDenied(run.message ?? "Ruxsat rad etildi", toolId));
    auditAi({ actor, action: "confirm", intent: payload.tool, status: "denied", denied });
    return { answer: { title: "Ruxsat yo‘q", lines: [run.message ?? ""] }, denied };
  }
  if (run.status === "error") {
    auditAi({ actor, action: "confirm", intent: payload.tool, status: "error", denied });
    return { answer: answerFromRun({ actor, toolId, run, intent: payload.tool, slots: scopedParams }), denied };
  }
  const payloadObj =
    run.payload && typeof run.payload === "object" ? (run.payload as { rows?: unknown }) : undefined;
  auditAi({
    actor,
    action: "confirm",
    intent: payload.tool,
    status: run.status,
    rows: Array.isArray(payloadObj?.rows) ? payloadObj.rows.length : undefined
  });
  return { answer: answerFromRun({ actor, toolId, run, intent: payload.tool, slots: scopedParams }), denied };
}
