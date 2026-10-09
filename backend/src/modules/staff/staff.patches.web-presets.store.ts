import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { isPositionCatalogRole } from "./position-catalog.roles";

function asTenantSettingsRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return { ...(v as Record<string, unknown>) };
  }
  return {};
}

export const WEB_STAFF_PRESET_MAX = 50;

/** `tenant_audit_events.entity_type` — bitta lavozim shabloni tarixini filtrlash uchun */
export const WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY = "web_staff_position_preset";

export type WebStaffPositionPresetDto = {
  id: string;
  label: string;
  /** Tizim roli (`User.role`) — katalog bog‘lanishi */
  role: string | null;
  code: string | null;
  comment: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  created_by_user_id: number | null;
  deactivated_at: string | null;
  deactivated_by_user_id: number | null;
};

export type WebStaffPositionPresetAdminDto = WebStaffPositionPresetDto & {
  created_by_label: string | null;
  deactivated_by_label: string | null;
  /** `User.position` shu shablon `label` bilan mos (trim) keladigan xodimlar soni */
  linked_operator_count: number;
};

function parseIsoDateString(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function parseOptionalUserId(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) return null;
  return v;
}

function parseOptionalCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 20);
  return t || null;
}

function parseOptionalComment(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 500);
  return t || null;
}

function parseOptionalRole(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return isPositionCatalogRole(t) ? t : null;
}

function parsePresetObject(o: Record<string, unknown>, fallbackOrder: number): WebStaffPositionPresetDto | null {
  const id =
    typeof o.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(o.id)
      ? o.id
      : null;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 128) : "";
  if (!id || !label) return null;
  const is_active = o.is_active !== false;
  const sort_order =
    typeof o.sort_order === "number" && Number.isFinite(o.sort_order) ? Math.floor(o.sort_order) : fallbackOrder;
  const created_at = parseIsoDateString(o.created_at) ?? "";
  return {
    id,
    label,
    role: parseOptionalRole(o.role),
    code: parseOptionalCode(o.code),
    comment: parseOptionalComment(o.comment),
    is_active,
    sort_order,
    created_at,
    created_by_user_id: parseOptionalUserId(o.created_by_user_id),
    deactivated_at: parseIsoDateString(o.deactivated_at),
    deactivated_by_user_id: parseOptionalUserId(o.deactivated_by_user_id)
  };
}

function presetsFromStringArray(arr: string[]): WebStaffPositionPresetDto[] {
  const labels = [...new Set(arr.map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 128)))].slice(
    0,
    WEB_STAFF_PRESET_MAX
  );
  const now = new Date().toISOString();
  return labels.map((label, i) => ({
    id: randomUUID(),
    label,
    role: null,
    code: null,
    comment: null,
    is_active: true,
    sort_order: i,
    created_at: now,
    created_by_user_id: null,
    deactivated_at: null,
    deactivated_by_user_id: null
  }));
}

function ensureCreatedAtOnPresets(presets: WebStaffPositionPresetDto[]): {
  presets: WebStaffPositionPresetDto[];
  changed: boolean;
} {
  const now = new Date().toISOString();
  let changed = false;
  const next = presets.map((p) => {
    const ca = typeof p.created_at === "string" ? p.created_at.trim() : "";
    if (ca && parseIsoDateString(ca)) return p;
    changed = true;
    return { ...p, created_at: now, created_by_user_id: p.created_by_user_id ?? null };
  });
  return { presets: next, changed };
}

export async function enrichPresetsWithUserLabels(
  tenantId: number,
  presets: WebStaffPositionPresetDto[]
): Promise<WebStaffPositionPresetAdminDto[]> {
  const ids = new Set<number>();
  for (const p of presets) {
    if (p.created_by_user_id != null) ids.add(p.created_by_user_id);
    if (p.deactivated_by_user_id != null) ids.add(p.deactivated_by_user_id);
  }
  const [actorUsers, staffPositions] = await Promise.all([
    ids.size > 0
      ? prisma.user.findMany({
          where: { tenant_id: tenantId, id: { in: [...ids] } },
          select: { id: true, name: true, login: true }
        })
      : Promise.resolve([] as { id: number; name: string; login: string }[]),
    prisma.user.findMany({
      where: { tenant_id: tenantId, position: { not: null } },
      select: { position: true }
    })
  ]);

  const labelById = new Map<number, string>();
  for (const u of actorUsers) {
    const n = u.name?.trim();
    labelById.set(u.id, n && n.length > 0 ? n : u.login);
  }

  const countByPositionLabel = new Map<string, number>();
  for (const row of staffPositions) {
    const t = row.position?.trim() ?? "";
    if (!t) continue;
    countByPositionLabel.set(t, (countByPositionLabel.get(t) ?? 0) + 1);
  }

  return presets.map((p) => ({
    ...p,
    created_by_label:
      p.created_by_user_id != null
        ? (labelById.get(p.created_by_user_id) ?? `ID ${p.created_by_user_id}`)
        : null,
    deactivated_by_label:
      p.deactivated_by_user_id != null
        ? (labelById.get(p.deactivated_by_user_id) ?? `ID ${p.deactivated_by_user_id}`)
        : null,
    linked_operator_count: countByPositionLabel.get(p.label) ?? 0
  }));
}

/** JSON: string[] (eski) yoki obyekt massivi */
function parsePresetsArray(raw: unknown): { presets: WebStaffPositionPresetDto[]; needsMigrate: boolean } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { presets: [], needsMigrate: false };
  }
  if (typeof raw[0] === "string") {
    return { presets: presetsFromStringArray(raw as string[]), needsMigrate: true };
  }
  const out: WebStaffPositionPresetDto[] = [];
  raw.forEach((item, i) => {
    if (item == null || typeof item !== "object" || Array.isArray(item)) return;
    const p = parsePresetObject(item as Record<string, unknown>, i);
    if (p) out.push(p);
  });
  return { presets: out.slice(0, WEB_STAFF_PRESET_MAX), needsMigrate: false };
}

export async function persistWebStaffPositionPresets(
  tenantId: number,
  presets: WebStaffPositionPresetDto[],
  actorUserId: number | null,
  action: string
): Promise<void> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!row) throw new Error("NOT_FOUND");

  const nextSettings = {
    ...asTenantSettingsRecord(row.settings),
    web_staff_position_presets: presets.map((p) => ({
      id: p.id,
      label: p.label,
      role: p.role,
      code: p.code,
      comment: p.comment,
      is_active: p.is_active,
      sort_order: p.sort_order,
      created_at: p.created_at,
      created_by_user_id: p.created_by_user_id,
      deactivated_at: p.deactivated_at,
      deactivated_by_user_id: p.deactivated_by_user_id
    }))
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings as Prisma.InputJsonValue }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.tenant_settings,
    entityId: tenantId,
    action,
    payload: { count: presets.length }
  });
}

export async function resolveWebStaffPresetsFromSettings(
  tenantId: number,
  settings: unknown
): Promise<WebStaffPositionPresetDto[]> {
  const { presets: parsed, needsMigrate } = parsePresetsArray(
    asTenantSettingsRecord(settings).web_staff_position_presets
  );
  const { presets: withCreated, changed: needCreated } = ensureCreatedAtOnPresets(parsed);
  let presets = withCreated;
  if (needsMigrate) {
    await persistWebStaffPositionPresets(tenantId, presets, null, "migrate.web_staff_position_presets");
  } else if (needCreated) {
    await persistWebStaffPositionPresets(tenantId, presets, null, "hydrate.web_staff_position_preset_timestamps");
  }
  return presets.sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ru"));
}

export async function loadWebStaffPositionPresets(tenantId: number): Promise<WebStaffPositionPresetDto[]> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!row) throw new Error("NOT_FOUND");

  return resolveWebStaffPresetsFromSettings(tenantId, row.settings);
}

export function activePresetLabels(presets: WebStaffPositionPresetDto[]): string[] {
  return [...new Set(presets.filter((p) => p.is_active).map((p) => p.label))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
}

/** Faol lavozimlar — ixtiyoriy rol filtri bilan (xodim formasi). */
export function activePresetsForRole(
  presets: WebStaffPositionPresetDto[],
  role?: string | null
): WebStaffPositionPresetDto[] {
  const active = presets.filter((p) => p.is_active);
  if (!role?.trim()) return active;
  const r = role.trim();
  const matched = active.filter((p) => p.role === r);
  // Rol bog‘lanmagan eski shablonlar ham tanlanishi mumkin
  const unscoped = active.filter((p) => p.role == null);
  return [...matched, ...unscoped].sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "ru"));
}
