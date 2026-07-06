import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { onAppAccessChanged } from "../auth/app-access.service";
import { parseMobileConfigV1, type AgentMobileConfigV1 } from "./agent-mobile-config";
import type { AgentEntitlements, ExpeditorAssignmentRules, StaffRow } from "./staff.shared";
import {
  applyTradeDirectionPatch,
  assertExpeditorMobileTradeDirections,
  normalizeAgentEntitlementsInput,
  normalizePriceTypes,
  parseEntitlements,
  parsePriceTypesJson,
  validateAgentEntitlements,
  validateExpeditorAssignmentRules
} from "./staff.shared";
import { applyAgentPatchInDb } from "./staff.patches.field";
import { listStaff, type PatchAgentInput } from "./staff.crud";

export type PatchExpeditorInput = Omit<PatchAgentInput, "supervisor_user_id"> & {
  expeditor_assignment_rules?: ExpeditorAssignmentRules;
};

export async function patchExpeditor(
  tenantId: number,
  expeditorId: number,
  input: PatchExpeditorInput,
  actorUserId: number | null = null
): Promise<StaffRow> {
  const existing = await prisma.user.findFirst({
    where: { id: expeditorId, tenant_id: tenantId, role: "expeditor" }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  if (input.warehouse_id !== undefined && input.warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({ where: { id: input.warehouse_id, tenant_id: tenantId } });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }
  if (input.return_warehouse_id !== undefined && input.return_warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: input.return_warehouse_id, tenant_id: tenantId }
    });
    if (!wh) throw new Error("BAD_RETURN_WAREHOUSE");
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.first_name !== undefined) data.first_name = input.first_name.trim();
  if (input.last_name !== undefined) data.last_name = input.last_name?.trim() || null;
  if (input.middle_name !== undefined) data.middle_name = input.middle_name?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.email !== undefined) data.email = input.email?.trim() || null;
  if (input.product !== undefined) data.product = input.product?.trim() || null;
  if (input.agent_type !== undefined) data.agent_type = input.agent_type?.trim() || null;
  if (input.code !== undefined) data.code = input.code?.trim() || null;
  if (input.pinfl !== undefined) data.pinfl = input.pinfl?.trim() || null;
  if (input.consignment !== undefined) data.consignment = input.consignment;
  if (input.apk_version !== undefined) data.apk_version = input.apk_version?.trim() || null;
  if (input.device_name !== undefined) data.device_name = input.device_name?.trim() || null;
  if (input.can_authorize !== undefined) data.can_authorize = input.can_authorize;
  if (input.price_type !== undefined) data.price_type = input.price_type?.trim() || null;
  if (input.agent_price_types !== undefined) {
    const arr = normalizePriceTypes(input.agent_price_types);
    data.agent_price_types = arr;
  } else if (input.price_type !== undefined) {
    const single = input.price_type?.trim() || null;
    data.agent_price_types = single ? [single] : [];
  }
  if (input.warehouse_id !== undefined) {
    data.warehouse =
      input.warehouse_id == null ? { disconnect: true } : { connect: { id: input.warehouse_id } };
  }
  if (input.return_warehouse_id !== undefined) {
    data.return_warehouse =
      input.return_warehouse_id == null
        ? { disconnect: true }
        : { connect: { id: input.return_warehouse_id } };
  }
  if (input.trade_direction_id !== undefined || input.trade_direction !== undefined) {
    await applyTradeDirectionPatch(tenantId, input, data);
  }
  if (input.branch !== undefined) data.branch = input.branch?.trim() || null;
  if (input.position !== undefined) data.position = input.position?.trim() || null;
  if (input.app_access !== undefined) data.app_access = input.app_access;
  if (input.territory !== undefined) data.territory = input.territory?.trim() || null;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.max_sessions !== undefined) {
    const n = input.max_sessions;
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("BAD_MAX_SESSIONS");
    data.max_sessions = n;
  }
  if (input.kpi_color !== undefined) data.kpi_color = input.kpi_color?.trim().slice(0, 16) || null;
  if (input.password !== undefined && input.password.trim().length > 0) {
    if (input.password.length < 6) throw new Error("BAD_PASSWORD");
    data.password_hash = await bcrypt.hash(input.password, 10);
  }

  if (input.expeditor_assignment_rules !== undefined) {
    await validateExpeditorAssignmentRules(tenantId, input.expeditor_assignment_rules);
    data.expeditor_assignment_rules = input.expeditor_assignment_rules as Prisma.InputJsonValue;
  }

  if (input.agent_entitlements !== undefined) {
    const prev = parseEntitlements(existing.agent_entitlements);
    const inc = parseEntitlements(input.agent_entitlements as unknown);
    const merged = normalizeAgentEntitlementsInput({
      price_types: inc.price_types ?? prev.price_types,
      product_rules: inc.product_rules ?? prev.product_rules,
      mobile_config: inc.mobile_config !== undefined ? inc.mobile_config : prev.mobile_config
    });
    await validateAgentEntitlements(tenantId, merged);
    await assertExpeditorMobileTradeDirections(tenantId, merged.mobile_config);
    data.agent_entitlements = merged as Prisma.InputJsonValue;
    const pt = merged.price_types;
    if (pt !== undefined) {
      data.agent_price_types = normalizePriceTypes(pt);
    }
  }

  if (Object.keys(data).length > 0) {
    if (input.first_name !== undefined || input.last_name !== undefined || input.middle_name !== undefined) {
      const first = input.first_name !== undefined ? input.first_name.trim() : existing.first_name ?? "";
      const last = input.last_name !== undefined ? input.last_name?.trim() || null : existing.last_name;
      const mid = input.middle_name !== undefined ? input.middle_name?.trim() || null : existing.middle_name;
      data.name = [last, first, mid].filter((x) => x && String(x).trim().length > 0).join(" ").trim() || existing.name;
    }

    await prisma.user.update({
      where: { id: expeditorId },
      data
    });

    if (input.app_access !== undefined) {
      await onAppAccessChanged(tenantId, expeditorId, input.app_access);
    }

    const auditKeys = Object.keys(data).filter((k) => k !== "password_hash");
    const auditPayload: Record<string, unknown> = { keys: auditKeys };
    if (data.agent_entitlements != null && typeof data.agent_entitlements === "object") {
      const mc = (data.agent_entitlements as Record<string, unknown>).mobile_config;
      if (mc != null && typeof mc === "object" && !Array.isArray(mc)) {
        auditPayload.mobile_config_section_keys = Object.keys(mc as Record<string, unknown>);
      }
    }
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: expeditorId,
      action: "patch.expeditor",
      payload: auditPayload
    });
  }

  const rows = await listStaff(tenantId, "expeditor");
  const row = rows.find((x) => x.id === expeditorId);
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

export type PatchCollectorInput = Omit<PatchAgentInput, "supervisor_user_id">;

export async function patchCollector(
  tenantId: number,
  collectorId: number,
  input: PatchCollectorInput,
  actorUserId: number | null = null
): Promise<StaffRow> {
  const existing = await prisma.user.findFirst({
    where: { id: collectorId, tenant_id: tenantId, role: "collector" }
  });
  if (!existing) throw new Error("NOT_FOUND");

  if (input.warehouse_id !== undefined && input.warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({ where: { id: input.warehouse_id, tenant_id: tenantId } });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }
  if (input.return_warehouse_id !== undefined && input.return_warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: input.return_warehouse_id, tenant_id: tenantId }
    });
    if (!wh) throw new Error("BAD_RETURN_WAREHOUSE");
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.first_name !== undefined) data.first_name = input.first_name.trim();
  if (input.last_name !== undefined) data.last_name = input.last_name?.trim() || null;
  if (input.middle_name !== undefined) data.middle_name = input.middle_name?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.email !== undefined) data.email = input.email?.trim() || null;
  if (input.product !== undefined) data.product = input.product?.trim() || null;
  if (input.agent_type !== undefined) data.agent_type = input.agent_type?.trim() || null;
  if (input.code !== undefined) data.code = input.code?.trim() || null;
  if (input.pinfl !== undefined) data.pinfl = input.pinfl?.trim() || null;
  if (input.consignment !== undefined) data.consignment = input.consignment;
  if (input.apk_version !== undefined) data.apk_version = input.apk_version?.trim() || null;
  if (input.device_name !== undefined) data.device_name = input.device_name?.trim() || null;
  if (input.can_authorize !== undefined) data.can_authorize = input.can_authorize;
  if (input.price_type !== undefined) data.price_type = input.price_type?.trim() || null;
  if (input.agent_price_types !== undefined) {
    const arr = normalizePriceTypes(input.agent_price_types);
    data.agent_price_types = arr;
  } else if (input.price_type !== undefined) {
    const single = input.price_type?.trim() || null;
    data.agent_price_types = single ? [single] : [];
  }
  if (input.warehouse_id !== undefined) {
    data.warehouse = input.warehouse_id == null ? { disconnect: true } : { connect: { id: input.warehouse_id } };
  }
  if (input.return_warehouse_id !== undefined) {
    data.return_warehouse =
      input.return_warehouse_id == null ? { disconnect: true } : { connect: { id: input.return_warehouse_id } };
  }
  if (input.trade_direction_id !== undefined || input.trade_direction !== undefined) {
    await applyTradeDirectionPatch(tenantId, input, data);
  }
  if (input.branch !== undefined) data.branch = input.branch?.trim() || null;
  if (input.position !== undefined) data.position = input.position?.trim() || null;
  if (input.app_access !== undefined) data.app_access = input.app_access;
  if (input.territory !== undefined) data.territory = input.territory?.trim() || null;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.max_sessions !== undefined) {
    const n = input.max_sessions;
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("BAD_MAX_SESSIONS");
    data.max_sessions = n;
  }
  if (input.kpi_color !== undefined) data.kpi_color = input.kpi_color?.trim().slice(0, 16) || null;
  if (input.password !== undefined && input.password.trim().length > 0) {
    if (input.password.length < 6) throw new Error("BAD_PASSWORD");
    data.password_hash = await bcrypt.hash(input.password, 10);
  }
  if (input.agent_entitlements !== undefined) {
    const prev = parseEntitlements(existing.agent_entitlements);
    const inc = parseEntitlements(input.agent_entitlements as unknown);
    const merged = normalizeAgentEntitlementsInput({
      price_types: inc.price_types ?? prev.price_types,
      product_rules: inc.product_rules ?? prev.product_rules,
      mobile_config: inc.mobile_config !== undefined ? inc.mobile_config : prev.mobile_config
    });
    await validateAgentEntitlements(tenantId, merged);
    data.agent_entitlements = merged as Prisma.InputJsonValue;
    const pt = merged.price_types;
    if (pt !== undefined) data.agent_price_types = normalizePriceTypes(pt);
  }

  if (Object.keys(data).length > 0) {
    if (input.first_name !== undefined || input.last_name !== undefined || input.middle_name !== undefined) {
      const first = input.first_name !== undefined ? input.first_name.trim() : existing.first_name ?? "";
      const last = input.last_name !== undefined ? input.last_name?.trim() || null : existing.last_name;
      const mid = input.middle_name !== undefined ? input.middle_name?.trim() || null : existing.middle_name;
      data.name = [last, first, mid].filter((x) => x && String(x).trim().length > 0).join(" ").trim() || existing.name;
    }
    await prisma.user.update({ where: { id: collectorId }, data });
    const auditKeys = Object.keys(data).filter((k) => k !== "password_hash");
    const auditPayload: Record<string, unknown> = { keys: auditKeys };
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: collectorId,
      action: "patch.collector",
      payload: auditPayload
    });
  }

  const rows = await listStaff(tenantId, "collector");
  const row = rows.find((x) => x.id === collectorId);
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

export type PatchAuditorInput = Omit<PatchAgentInput, "supervisor_user_id">;

export async function patchAuditor(
  tenantId: number,
  auditorId: number,
  input: PatchAuditorInput,
  actorUserId: number | null = null
): Promise<StaffRow> {
  const existing = await prisma.user.findFirst({
    where: { id: auditorId, tenant_id: tenantId, role: "auditor" }
  });
  if (!existing) throw new Error("NOT_FOUND");

  const data: Prisma.UserUpdateInput = {};
  if (input.first_name !== undefined) data.first_name = input.first_name.trim();
  if (input.last_name !== undefined) data.last_name = input.last_name?.trim() || null;
  if (input.middle_name !== undefined) data.middle_name = input.middle_name?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.email !== undefined) data.email = input.email?.trim() || null;
  if (input.code !== undefined) data.code = input.code?.trim() || null;
  if (input.pinfl !== undefined) data.pinfl = input.pinfl?.trim() || null;
  if (input.apk_version !== undefined) data.apk_version = input.apk_version?.trim() || null;
  if (input.device_name !== undefined) data.device_name = input.device_name?.trim() || null;
  if (input.can_authorize !== undefined) data.can_authorize = input.can_authorize;
  if (input.branch !== undefined) data.branch = input.branch?.trim() || null;
  if (input.position !== undefined) data.position = input.position?.trim() || null;
  if (input.app_access !== undefined) data.app_access = input.app_access;
  if (input.territory !== undefined) data.territory = input.territory?.trim() || null;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.max_sessions !== undefined) {
    const n = input.max_sessions;
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("BAD_MAX_SESSIONS");
    data.max_sessions = n;
  }
  if (input.kpi_color !== undefined) data.kpi_color = input.kpi_color?.trim().slice(0, 16) || null;
  if (input.password !== undefined && input.password.trim().length > 0) {
    if (input.password.length < 6) throw new Error("BAD_PASSWORD");
    data.password_hash = await bcrypt.hash(input.password, 10);
  }
  if (input.agent_entitlements !== undefined) {
    const prev = parseEntitlements(existing.agent_entitlements);
    const inc = parseEntitlements(input.agent_entitlements as unknown);
    const merged = normalizeAgentEntitlementsInput({
      price_types: inc.price_types ?? prev.price_types,
      product_rules: inc.product_rules ?? prev.product_rules,
      mobile_config: inc.mobile_config !== undefined ? inc.mobile_config : prev.mobile_config
    });
    await validateAgentEntitlements(tenantId, merged);
    data.agent_entitlements = merged as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length > 0) {
    if (input.first_name !== undefined || input.last_name !== undefined || input.middle_name !== undefined) {
      const first = input.first_name !== undefined ? input.first_name.trim() : existing.first_name ?? "";
      const last = input.last_name !== undefined ? input.last_name?.trim() || null : existing.last_name;
      const mid = input.middle_name !== undefined ? input.middle_name?.trim() || null : existing.middle_name;
      data.name = [last, first, mid].filter((x) => x && String(x).trim().length > 0).join(" ").trim() || existing.name;
    }
    await prisma.user.update({ where: { id: auditorId }, data });
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: auditorId,
      action: "patch.auditor",
      payload: { keys: Object.keys(data).filter((k) => k !== "password_hash") }
    });
  }

  const rows = await listStaff(tenantId, "auditor");
  const row = rows.find((x) => x.id === auditorId);
  if (!row) throw new Error("NOT_FOUND");
  return row;
}






