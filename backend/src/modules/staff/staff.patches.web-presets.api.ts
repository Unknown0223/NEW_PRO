import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { listTenantAuditEvents } from "../audit-events/audit-events.service";
import { activeBranchNamesFromReferences } from "../tenant-settings/tenant-settings.refs";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { isPositionCatalogRole } from "./position-catalog.roles";
import {
  WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
  WEB_STAFF_PRESET_MAX,
  type WebStaffPositionPresetAdminDto,
  type WebStaffPositionPresetDto,
  activePresetLabels,
  activePresetsForRole,
  enrichPresetsWithUserLabels,
  loadWebStaffPositionPresets,
  persistWebStaffPositionPresets,
  resolveWebStaffPresetsFromSettings
} from "./staff.patches.web-presets.store";

export type CreatePositionPresetInput = {
  label: string;
  role?: string | null;
  code?: string | null;
  comment?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

export type PatchPositionPresetInput = {
  label?: string;
  role?: string | null;
  code?: string | null;
  comment?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

function normalizeCode(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim().slice(0, 20);
  return t || null;
}

function normalizeComment(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim().slice(0, 500);
  return t || null;
}

function normalizeRole(v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const t = String(v).trim();
  if (!isPositionCatalogRole(t)) throw new Error("BAD_ROLE");
  return t;
}

export async function listWebPanelStaffFilterOptions(tenantId: number): Promise<{
  branches: string[];
  positions: string[];
  position_presets: string[];
  /** To‘liq faol shablonlar (rol/code bilan) — formalar uchun */
  position_preset_rows: WebStaffPositionPresetDto[];
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, settings: true }
  });
  const presetRows =
    tenant != null ? await resolveWebStaffPresetsFromSettings(tenant.id, tenant.settings) : [];
  const presetLabelActive = activePresetLabels(presetRows);
  const ref = asRecord(asRecord(tenant?.settings).references);
  const branches = activeBranchNamesFromReferences(ref);
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  return {
    branches,
    positions: [...presetLabelActive].sort(sort),
    position_presets: presetLabelActive,
    position_preset_rows: activePresetsForRole(presetRows)
  };
}

export async function listWebStaffPositionPresetsAdmin(tenantId: number): Promise<WebStaffPositionPresetAdminDto[]> {
  const presets = await loadWebStaffPositionPresets(tenantId);
  return enrichPresetsWithUserLabels(tenantId, presets);
}

export async function listWebStaffPositionPresetHistory(tenantId: number, presetId: string) {
  const id = presetId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("BAD_PRESET_ID");
  }
  return listTenantAuditEvents(tenantId, {
    entity_type: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
    entity_id: id,
    page: 1,
    limit: 200
  });
}

export async function createWebStaffPositionPreset(
  tenantId: number,
  input: CreatePositionPresetInput | string,
  actorUserId: number | null = null
): Promise<WebStaffPositionPresetAdminDto> {
  const body: CreatePositionPresetInput = typeof input === "string" ? { label: input } : input;
  const trimmed = body.label.trim().slice(0, 128);
  if (!trimmed) throw new Error("BAD_LABEL");

  const presets = await loadWebStaffPositionPresets(tenantId);
  if (presets.length >= WEB_STAFF_PRESET_MAX) throw new Error("PRESET_LIMIT");
  if (presets.some((p) => p.label.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error("DUPLICATE_LABEL");
  }

  const maxOrder = presets.reduce((m, p) => Math.max(m, p.sort_order), -1);
  const sort_order =
    body.sort_order != null && Number.isFinite(body.sort_order)
      ? Math.floor(body.sort_order)
      : maxOrder + 1;
  const now = new Date().toISOString();
  const uid = actorUserId != null && Number.isInteger(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const is_active = body.is_active !== false;
  const created: WebStaffPositionPresetDto = {
    id: randomUUID(),
    label: trimmed,
    role: normalizeRole(body.role),
    code: normalizeCode(body.code),
    comment: normalizeComment(body.comment),
    is_active,
    sort_order,
    created_at: now,
    created_by_user_id: uid,
    deactivated_at: is_active ? null : now,
    deactivated_by_user_id: is_active ? null : uid
  };
  const next = [...presets, created].sort((a, b) => a.sort_order - b.sort_order);
  await persistWebStaffPositionPresets(tenantId, next, actorUserId, "create.web_staff_position_preset");

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
    entityId: created.id,
    action: "create",
    payload: {
      label: created.label,
      role: created.role,
      code: created.code,
      comment: created.comment,
      sort_order: created.sort_order
    }
  });

  const [enriched] = await enrichPresetsWithUserLabels(tenantId, [created]);
  if (!enriched) throw new Error("NOT_FOUND");
  return enriched;
}

export async function patchWebStaffPositionPreset(
  tenantId: number,
  presetId: string,
  input: PatchPositionPresetInput,
  actorUserId: number | null = null
): Promise<WebStaffPositionPresetAdminDto> {
  const id = presetId.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("BAD_PRESET_ID");
  }

  const presets = await loadWebStaffPositionPresets(tenantId);
  const idx = presets.findIndex((p) => p.id === id);
  if (idx < 0) throw new Error("NOT_FOUND");

  const cur = presets[idx]!;
  let label = cur.label;
  if (input.label !== undefined) {
    const t = input.label.trim().slice(0, 128);
    if (!t) throw new Error("BAD_LABEL");
    if (presets.some((p) => p.id !== id && p.label.toLowerCase() === t.toLowerCase())) {
      throw new Error("DUPLICATE_LABEL");
    }
    label = t;
  }

  const role = input.role !== undefined ? normalizeRole(input.role) : cur.role;
  const code = input.code !== undefined ? normalizeCode(input.code) : cur.code;
  const comment = input.comment !== undefined ? normalizeComment(input.comment) : cur.comment;
  const sort_order =
    input.sort_order !== undefined && input.sort_order != null && Number.isFinite(input.sort_order)
      ? Math.floor(input.sort_order)
      : cur.sort_order;
  const is_active = input.is_active !== undefined ? input.is_active : cur.is_active;

  const uid = actorUserId != null && Number.isInteger(actorUserId) && actorUserId > 0 ? actorUserId : null;
  let deactivated_at = cur.deactivated_at;
  let deactivated_by_user_id = cur.deactivated_by_user_id;
  if (is_active) {
    deactivated_at = null;
    deactivated_by_user_id = null;
  } else if (cur.is_active) {
    const now = new Date().toISOString();
    deactivated_at = now;
    deactivated_by_user_id = uid;
  }

  const updated: WebStaffPositionPresetDto = {
    ...cur,
    label,
    role,
    code,
    comment,
    sort_order,
    is_active,
    deactivated_at,
    deactivated_by_user_id
  };
  const next = [...presets];
  next[idx] = updated;
  await persistWebStaffPositionPresets(tenantId, next, actorUserId, "patch.web_staff_position_preset");

  // Nom o‘zgarsa — xodimlar `position` matnini yangilash (bog‘lanish saqlanadi)
  if (label !== cur.label) {
    await prisma.user.updateMany({
      where: { tenant_id: tenantId, position: cur.label },
      data: { position: label }
    });
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
      entityId: id,
      action: "patch.label",
      payload: { from: cur.label, to: label }
    });
  }
  if (
    input.role !== undefined ||
    input.code !== undefined ||
    input.comment !== undefined ||
    input.sort_order !== undefined
  ) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
      entityId: id,
      action: "patch.fields",
      payload: {
        role: updated.role,
        code: updated.code,
        comment: updated.comment,
        sort_order: updated.sort_order
      }
    });
  }
  if (input.is_active === true && cur.is_active === false) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
      entityId: id,
      action: "reactivate",
      payload: { label }
    });
  }
  if (input.is_active === false && cur.is_active === true) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
      entityId: id,
      action: "deactivate",
      payload: { label }
    });
  }

  const [enriched] = await enrichPresetsWithUserLabels(tenantId, [updated]);
  if (!enriched) throw new Error("NOT_FOUND");
  return enriched;
}
