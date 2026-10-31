import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AuditEntityType, sanitizePayloadForAudit } from "../../lib/tenant-audit";
import { mergeTabelAudit, readTabelAudit } from "../tabel/tabel-audit";
import {
  describeAgentNormChanges,
  parseAgentNormConfig,
  parseAgentNormOverrides,
  summarizeAgentNorm,
  parseLeaderMinusRules,
  type AgentNormConfig,
  type AgentNormOverride,
  type LeaderMinusRule
} from "./timesheet.agent-norm.pure";
import { isGpsTrackedRole } from "./timesheet.day-status";

export type AgentNormSaveInput = {
  enabled: boolean;
  start_date: string;
  open_amount: number;
  closed_amount: number;
  min_orders?: number;
  half_day_ratio?: number;
  overrides?: AgentNormOverride[];
  leader_rules?: LeaderMinusRule[];
};

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

async function sanitizeLeaderRules(tenantId: number, list: LeaderMinusRule[]): Promise<LeaderMinusRule[]> {
  const parsed = parseLeaderMinusRules(list);
  const ids = parsed.flatMap((r) => (r.user_id != null ? [r.user_id] : []));
  if (ids.length === 0) return parsed;
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, role: true }
  });
  const byId = new Map(users.map((u) => [u.id, u.role.trim().toLowerCase()]));
  return parsed.flatMap((r) => {
    if (r.user_id == null) return [r];
    const role = byId.get(r.user_id);
    if (!role) return [];
    return [{ ...r, role }];
  });
}

async function sanitizeOverrides(tenantId: number, list: AgentNormOverride[]): Promise<AgentNormOverride[]> {
  const parsed = parseAgentNormOverrides(list);
  if (parsed.length === 0) return [];
  const ids = parsed.map((o) => o.user_id);
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: ids } },
    select: { id: true, role: true }
  });
  const ok = new Set(users.filter((u) => isGpsTrackedRole(u.role)).map((u) => u.id));
  const bad = ids.filter((id) => !ok.has(id));
  if (bad.length) {
    const err = new Error("INVALID_OVERRIDE_USERS");
    (err as Error & { ids: number[] }).ids = bad;
    throw err;
  }
  return parsed;
}

export async function saveAgentNormSettings(
  tenantId: number,
  input: AgentNormSaveInput,
  actor: { userId: number | null; label: string; comment?: string }
): Promise<AgentNormSettingsDto> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!t) throw new Error("NOT_FOUND");
  const prev = parseAgentNormConfig(t.settings);
  const overrides = input.overrides !== undefined ? await sanitizeOverrides(tenantId, input.overrides) : prev.overrides;
  const leaderRules =
    input.leader_rules !== undefined ? await sanitizeLeaderRules(tenantId, input.leader_rules) : prev.leader_rules;
  const next: AgentNormConfig = {
    enabled: input.enabled,
    start_date: input.start_date,
    open_amount: Math.round(input.open_amount),
    closed_amount: Math.round(input.closed_amount),
    min_orders: input.min_orders !== undefined ? Math.max(0, Math.floor(input.min_orders)) : prev.min_orders,
    half_day_ratio:
      input.half_day_ratio !== undefined ? Math.min(1, Math.max(0, input.half_day_ratio)) : prev.half_day_ratio,
    overrides,
    leader_rules: leaderRules
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
