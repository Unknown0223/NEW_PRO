import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AuditEntityType, sanitizePayloadForAudit } from "../../lib/tenant-audit";
import { mergeTabelAudit, readTabelAudit } from "../tabel/tabel-audit";
import {
  describeAgentNormChanges,
  parseAgentNormConfig,
  summarizeAgentNorm,
  type AgentNormConfig
} from "./timesheet.agent-norm.pure";

export type AgentNormSettingsDto = AgentNormConfig & {
  updated_at: string | null;
  updated_by: string | null;
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function readMeta(settings: Prisma.JsonValue | null | undefined): { updated_at: string | null; updated_by: string | null } {
  const raw = asObj(asObj(asObj(settings).timesheet).agent_norm);
  return {
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    updated_by: typeof raw.updated_by === "string" ? raw.updated_by : null
  };
}

export async function getAgentNormSettings(tenantId: number): Promise<AgentNormSettingsDto> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!t) throw new Error("NOT_FOUND");
  return { ...parseAgentNormConfig(t.settings), ...readMeta(t.settings) };
}

export async function saveAgentNormSettings(
  tenantId: number,
  input: AgentNormConfig,
  actor: { userId: number | null; label: string; comment?: string }
): Promise<AgentNormSettingsDto> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!t) throw new Error("NOT_FOUND");
  const prev = parseAgentNormConfig(t.settings);
  const next: AgentNormConfig = {
    enabled: input.enabled,
    start_date: input.start_date,
    open_amount: Math.round(input.open_amount),
    closed_amount: Math.round(input.closed_amount)
  };
  const changes = describeAgentNormChanges(prev, next);
  if (changes.length === 0) return { ...prev, ...readMeta(t.settings) };

  const now = new Date().toISOString();
  const root = asObj(t.settings);
  const ts = asObj(root.timesheet);
  const userComment = actor.comment?.trim();
  const settingsRoot: Record<string, unknown> = {
    ...root,
    timesheet: { ...ts, agent_norm: { ...next, updated_at: now, updated_by: actor.label } },
    tabel_audit: mergeTabelAudit(readTabelAudit(t.settings), [
      {
        module: "timesheet",
        kind: "settings",
        title: "Норматив агентов",
        oldValue: summarizeAgentNorm(prev),
        newValue: summarizeAgentNorm(next),
        comment: userComment ? `${changes.join("; ")}. Комментарий: ${userComment}` : changes.join("; "),
        changedBy: actor.label
      }
    ])
  };

  await prisma.tenant.update({ where: { id: tenantId }, data: { settings: settingsRoot as Prisma.InputJsonValue } });
  await prisma.tenantAuditEvent.create({
    data: {
      tenant_id: tenantId,
      actor_user_id: actor.userId,
      entity_type: AuditEntityType.tenant_settings,
      entity_id: String(tenantId),
      action: "timesheet.norm.settings",
      payload: sanitizePayloadForAudit({ old: prev, new: next, comment: userComment ?? null }) as Prisma.InputJsonValue
    }
  });
  return { ...next, updated_at: now, updated_by: actor.label };
}
