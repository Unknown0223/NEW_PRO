import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { createCashDeskUserLink } from "../cash-desks/cash-desks.service";
import { listActiveTradeDirectionLabels } from "../sales-directions/sales-directions.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { territoryRegionPickerNames } from "../tenant-settings/tenant-settings.service";
import { listTenantAuditEvents } from "../audit-events/audit-events.service";
import {
  parseMobileConfigV1,
  validateAgentMobileConfig,
  type AgentMobileConfigV1
} from "./agent-mobile-config";
import {
  assertValidEntitlementsKeys,
  normalizeWarehouseStaffEntitlementsRow,
  toPrismaJsonEntitlements
} from "./skladchik-entitlements";
import type { DistributionWebStaffRole } from "../../lib/tenant-user-roles";
import {
  ADMIN_AND_OPERATOR_LIKE_ROLES,
  DISTRIBUTION_WEB_STAFF_ROLES,
  OPERATOR_LIKE_WEB_ROLES,
  WEB_PANEL_STAFF_ROLES
} from "../../lib/tenant-user-roles";

import type {
  AgentEntitlements,
  CreateStaffInput,
  ExpeditorAssignmentRules,
  ListStaffFilters,
  StaffCreateResult,
  StaffKind,
  StaffRow
} from "./staff.shared";
import {
  SKLADCHIK_WAREHOUSE_LINK_ROLE,
  STAFF_KINDS_WITH_WORK_SLOT,
  applyTradeDirectionPatch,
  assertExpeditorMobileTradeDirections,
  assertWarehousesBelongToTenant,
  kindRole,
  mergePriceTypesForUser,
  normalizeAgentEntitlementsInput,
  normalizePositiveIntIds,
  normalizePriceTypes,
  parseEntitlements,
  parseExpeditorAssignmentRules,
  parsePriceTypesJson,
  refStringListFromTenantSettings,
  syncSkladchikWarehouseLinks,
  toFio,
  tradeDirectionDisplayFromRef,
  tradeDirectionForCreate,
  validateAgentEntitlements,
  validateExpeditorAssignmentRules
} from "./staff.shared";
import { listStaff, type PatchAgentInput, type SessionRowDto } from "./staff.crud";
export async function applyAgentPatchInDb(
  tenantId: number,
  agentId: number,
  input: PatchAgentInput,
  actorUserId: number | null = null
): Promise<void> {
  const existing = await prisma.user.findFirst({
    where: { id: agentId, tenant_id: tenantId, role: "agent" }
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

  if (input.supervisor_user_id !== undefined) {
    const sid = input.supervisor_user_id;
    if (sid != null) {
      if (sid === agentId) throw new Error("SELF_SUPERVISOR");
      const sup = await prisma.user.findFirst({
        where: { id: sid, tenant_id: tenantId, is_active: true, role: "supervisor" }
      });
      if (!sup) throw new Error("BAD_SUPERVISOR");
    }
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
  let touchConsignmentSettings = false;
  if (input.consignment !== undefined) {
    data.consignment = input.consignment;
    touchConsignmentSettings = true;
  }
  if (input.consignment_limit_amount !== undefined) {
    if (input.consignment_limit_amount == null || String(input.consignment_limit_amount).trim() === "") {
      data.consignment_limit_amount = null;
    } else {
      const d = new Prisma.Decimal(input.consignment_limit_amount);
      if (d.lt(0)) throw new Error("BAD_LIMIT");
      data.consignment_limit_amount = d;
    }
    touchConsignmentSettings = true;
  }
  if (input.consignment_ignore_previous_months_debt !== undefined) {
    data.consignment_ignore_previous_months_debt = input.consignment_ignore_previous_months_debt;
    touchConsignmentSettings = true;
  }
  if (touchConsignmentSettings) {
    let effectiveLimit: Prisma.Decimal | null = existing.consignment_limit_amount;
    if (input.consignment_limit_amount !== undefined) {
      if (input.consignment_limit_amount == null || String(input.consignment_limit_amount).trim() === "") {
        effectiveLimit = null;
      } else {
        effectiveLimit = data.consignment_limit_amount as Prisma.Decimal;
      }
    }
    /** «Без долгов прошлых месяцев» действует только при установленном лимите */
    if (effectiveLimit == null) {
      data.consignment_ignore_previous_months_debt = false;
    }
    data.consignment_updated_at = new Date();
  }
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
  if (input.agent_entitlements !== undefined) {
    const normalized = normalizeAgentEntitlementsInput(input.agent_entitlements);
    await validateAgentEntitlements(tenantId, normalized);
    data.agent_entitlements = normalized as Prisma.InputJsonValue;
    const pt = normalized.price_types;
    if (pt !== undefined) {
      data.agent_price_types = normalizePriceTypes(pt);
    }
  }
  if (input.supervisor_user_id !== undefined) {
    data.supervisor =
      input.supervisor_user_id == null
        ? { disconnect: true }
        : { connect: { id: input.supervisor_user_id } };
  }
  if (input.password !== undefined && input.password.trim().length > 0) {
    if (input.password.length < 6) throw new Error("BAD_PASSWORD");
    data.password_hash = await bcrypt.hash(input.password, 10);
  }

  if (Object.keys(data).length > 0) {
    if (input.first_name !== undefined || input.last_name !== undefined || input.middle_name !== undefined) {
      const first = input.first_name !== undefined ? input.first_name.trim() : existing.first_name ?? "";
      const last = input.last_name !== undefined ? input.last_name?.trim() || null : existing.last_name;
      const mid = input.middle_name !== undefined ? input.middle_name?.trim() || null : existing.middle_name;
      data.name = [last, first, mid].filter((x) => x && String(x).trim().length > 0).join(" ").trim() || existing.name;
    }

    await prisma.user.update({
      where: { id: agentId },
      data
    });

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
      entityId: agentId,
      action: "patch.agent",
      payload: auditPayload
    });
  }
}

export async function patchAgent(
  tenantId: number,
  agentId: number,
  input: PatchAgentInput,
  actorUserId: number | null = null
): Promise<StaffRow> {
  await applyAgentPatchInDb(tenantId, agentId, input, actorUserId);
  const rows = await listStaff(tenantId, "agent");
  const row = rows.find((x) => x.id === agentId);
  if (!row) throw new Error("NOT_FOUND");
  return row;
}
