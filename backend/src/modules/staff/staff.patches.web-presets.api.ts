import { randomUUID } from "node:crypto";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { listTenantAuditEvents } from "../audit-events/audit-events.service";
import { WEB_PANEL_STAFF_ROLES } from "../../lib/tenant-user-roles";
import {
  WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
  WEB_STAFF_PRESET_MAX,
  type WebStaffPositionPresetAdminDto,
  type WebStaffPositionPresetDto,
  activePresetLabels,
  enrichPresetsWithUserLabels,
  loadWebStaffPositionPresets,
  persistWebStaffPositionPresets,
  resolveWebStaffPresetsFromSettings
} from "./staff.patches.web-presets.store";

export async function listWebPanelStaffFilterOptions(tenantId: number): Promise<{
  branches: string[];
  positions: string[];
  /** Tenant bo‘yicha saqlangan lavozim nomlari (shablonlar) */
  position_presets: string[];
}> {
  const [rows, tenant] = await Promise.all([
    prisma.user.findMany({
      where: { tenant_id: tenantId, role: { in: [...WEB_PANEL_STAFF_ROLES] } },
      select: { branch: true, position: true }
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true }
    })
  ]);
  const presetRows =
    tenant != null
      ? await resolveWebStaffPresetsFromSettings(tenant.id, tenant.settings)
      : [];
  const presetLabelActive = activePresetLabels(presetRows);
  const branches = new Set<string>();
  const positions = new Set<string>();
  for (const p of presetLabelActive) positions.add(p);
  for (const r of rows) {
    if (r.branch?.trim()) branches.add(r.branch.trim());
    if (r.position?.trim()) positions.add(r.position.trim());
  }
  const sort = (a: string, b: string) => a.localeCompare(b, "ru");
  const positionsArr = [...positions].sort(sort);
  return {
    branches: [...branches].sort(sort),
    positions: positionsArr,
    /** Faqat faol shablonlar nomi (formalar / filtr datalist) */
    position_presets: presetLabelActive
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
  label: string,
  actorUserId: number | null = null
): Promise<WebStaffPositionPresetAdminDto> {
  const trimmed = label.trim().slice(0, 128);
  if (!trimmed) throw new Error("BAD_LABEL");

  const presets = await loadWebStaffPositionPresets(tenantId);
  if (presets.length >= WEB_STAFF_PRESET_MAX) throw new Error("PRESET_LIMIT");

  const maxOrder = presets.reduce((m, p) => Math.max(m, p.sort_order), -1);
  const now = new Date().toISOString();
  const uid = actorUserId != null && Number.isInteger(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const created: WebStaffPositionPresetDto = {
    id: randomUUID(),
    label: trimmed,
    is_active: true,
    sort_order: maxOrder + 1,
    created_at: now,
    created_by_user_id: uid,
    deactivated_at: null,
    deactivated_by_user_id: null
  };
  const next = [...presets, created].sort((a, b) => a.sort_order - b.sort_order);
  await persistWebStaffPositionPresets(tenantId, next, actorUserId, "create.web_staff_position_preset");

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
    entityId: created.id,
    action: "create",
    payload: { label: created.label }
  });

  const [enriched] = await enrichPresetsWithUserLabels(tenantId, [created]);
  if (!enriched) throw new Error("NOT_FOUND");
  return enriched;
}

export async function patchWebStaffPositionPreset(
  tenantId: number,
  presetId: string,
  input: { label?: string; is_active?: boolean },
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
    label = t;
  }
  const is_active = input.is_active !== undefined ? input.is_active : cur.is_active;

  const uid = actorUserId != null && Number.isInteger(actorUserId) && actorUserId > 0 ? actorUserId : null;
  let deactivated_at = cur.deactivated_at;
  let deactivated_by_user_id = cur.deactivated_by_user_id;
  if (is_active) {
    deactivated_at = null;
    deactivated_by_user_id = null;
  } else if (!cur.is_active) {
    /* no-op */
  } else {
    const now = new Date().toISOString();
    deactivated_at = now;
    deactivated_by_user_id = uid;
  }

  const updated: WebStaffPositionPresetDto = {
    ...cur,
    label,
    is_active,
    deactivated_at,
    deactivated_by_user_id
  };
  const next = [...presets];
  next[idx] = updated;
  await persistWebStaffPositionPresets(tenantId, next, actorUserId, "patch.web_staff_position_preset");

  if (input.label !== undefined && label !== cur.label) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: WEB_STAFF_POSITION_PRESET_AUDIT_ENTITY,
      entityId: id,
      action: "patch.label",
      payload: { from: cur.label, to: label }
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

