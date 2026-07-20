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
import { onAppAccessChanged } from "../auth/app-access.service";
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

export type PatchOperatorInput = {
  first_name?: string;
  last_name?: string | null;
  middle_name?: string | null;
  phone?: string | null;
  email?: string | null;
  code?: string | null;
  pinfl?: string | null;
  branch?: string | null;
  position?: string | null;
  can_authorize?: boolean;
  is_active?: boolean;
  app_access?: boolean;
  max_sessions?: number;
  password?: string;
};

export async function patchOperator(
  tenantId: number,
  operatorId: number,
  input: PatchOperatorInput,
  actorUserId: number | null = null
): Promise<StaffRow> {
  const existing = await prisma.user.findFirst({
    where: { id: operatorId, tenant_id: tenantId, role: { in: [...OPERATOR_LIKE_WEB_ROLES] } }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.first_name !== undefined) data.first_name = input.first_name.trim();
  if (input.last_name !== undefined) data.last_name = input.last_name?.trim() || null;
  if (input.middle_name !== undefined) data.middle_name = input.middle_name?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.email !== undefined) data.email = input.email?.trim() || null;
  if (input.code !== undefined) data.code = input.code?.trim().slice(0, 24) || null;
  if (input.pinfl !== undefined) data.pinfl = input.pinfl?.trim().slice(0, 24) || null;
  if (input.branch !== undefined) data.branch = input.branch?.trim().slice(0, 128) || null;
  if (input.position !== undefined) data.position = input.position?.trim().slice(0, 128) || null;
  if (input.can_authorize !== undefined) data.can_authorize = input.can_authorize;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.app_access !== undefined) data.app_access = input.app_access;
  if (input.max_sessions !== undefined) {
    const n = input.max_sessions;
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("BAD_MAX_SESSIONS");
    data.max_sessions = n;
  }
  if (input.password !== undefined && input.password.trim().length > 0) {
    if (input.password.length < 6) throw new Error("BAD_PASSWORD");
    data.password_hash = await bcrypt.hash(input.password, 10);
  }

  if (Object.keys(data).length > 0) {
    if (input.first_name !== undefined || input.last_name !== undefined || input.middle_name !== undefined) {
      const first =
        input.first_name !== undefined ? input.first_name.trim() : existing.first_name ?? "";
      const last = input.last_name !== undefined ? input.last_name?.trim() || null : existing.last_name;
      const mid =
        input.middle_name !== undefined ? input.middle_name?.trim() || null : existing.middle_name;
      data.name =
        [last, first, mid].filter((x) => x && String(x).trim().length > 0).join(" ").trim() ||
        existing.name;
    }

    await prisma.user.update({
      where: { id: operatorId },
      data
    });

    if (input.app_access !== undefined) {
      await onAppAccessChanged(tenantId, operatorId, input.app_access);
    }

    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: operatorId,
      action: "patch.operator",
      payload: { keys: Object.keys(data).filter((k) => k !== "password_hash") }
    });
  }

  const rows = await listStaff(tenantId, "operator");
  const row = rows.find((x) => x.id === operatorId);
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

export type PatchSkladchikInput = {
  first_name?: string;
  last_name?: string | null;
  middle_name?: string | null;
  phone?: string | null;
  email?: string | null;
  code?: string | null;
  pinfl?: string | null;
  branch?: string | null;
  position?: string | null;
  can_authorize?: boolean;
  is_active?: boolean;
  app_access?: boolean;
  max_sessions?: number;
  password?: string;
  warehouse_ids?: number[];
  warehouse_staff_entitlements?: Record<string, boolean>;
};

export async function patchSkladchik(
  tenantId: number,
  skladchikId: number,
  input: PatchSkladchikInput,
  actorUserId: number | null = null
): Promise<StaffRow> {
  const existing = await prisma.user.findFirst({
    where: { id: skladchikId, tenant_id: tenantId, role: "skladchik" }
  });
  if (!existing) {
    throw new Error("NOT_FOUND");
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.first_name !== undefined) data.first_name = input.first_name.trim();
  if (input.last_name !== undefined) data.last_name = input.last_name?.trim() || null;
  if (input.middle_name !== undefined) data.middle_name = input.middle_name?.trim() || null;
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
  if (input.email !== undefined) data.email = input.email?.trim() || null;
  if (input.code !== undefined) data.code = input.code?.trim().slice(0, 24) || null;
  if (input.pinfl !== undefined) data.pinfl = input.pinfl?.trim().slice(0, 24) || null;
  if (input.branch !== undefined) data.branch = input.branch?.trim().slice(0, 128) || null;
  if (input.position !== undefined) data.position = input.position?.trim().slice(0, 128) || null;
  if (input.can_authorize !== undefined) data.can_authorize = input.can_authorize;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  if (input.app_access !== undefined) data.app_access = input.app_access;
  if (input.max_sessions !== undefined) {
    const n = input.max_sessions;
    if (!Number.isInteger(n) || n < 1 || n > 99) throw new Error("BAD_MAX_SESSIONS");
    data.max_sessions = n;
  }
  if (input.password !== undefined && input.password.trim().length > 0) {
    if (input.password.length < 6) throw new Error("BAD_PASSWORD");
    data.password_hash = await bcrypt.hash(input.password, 10);
  }

  if (input.warehouse_ids !== undefined) {
    const whIds = normalizePositiveIntIds(input.warehouse_ids);
    await assertWarehousesBelongToTenant(tenantId, whIds);
    data.warehouse = whIds.length > 0 ? { connect: { id: whIds[0]! } } : { disconnect: true };
  }

  if (input.warehouse_staff_entitlements !== undefined) {
    assertValidEntitlementsKeys(input.warehouse_staff_entitlements);
    data.warehouse_staff_entitlements = toPrismaJsonEntitlements(input.warehouse_staff_entitlements);
  }

  if (input.first_name !== undefined || input.last_name !== undefined || input.middle_name !== undefined) {
    const first =
      input.first_name !== undefined ? input.first_name.trim() : existing.first_name ?? "";
    const last = input.last_name !== undefined ? input.last_name?.trim() || null : existing.last_name;
    const mid =
      input.middle_name !== undefined ? input.middle_name?.trim() || null : existing.middle_name;
    data.name =
      [last, first, mid].filter((x) => x && String(x).trim().length > 0).join(" ").trim() ||
      existing.name;
  }

  const touchWarehouseLinks = input.warehouse_ids !== undefined;
  const touchEntitlements = input.warehouse_staff_entitlements !== undefined;

  if (Object.keys(data).length > 0) {
    await prisma.user.update({
      where: { id: skladchikId },
      data
    });
    if (input.app_access !== undefined) {
      await onAppAccessChanged(tenantId, skladchikId, input.app_access);
    }
  }

  if (touchWarehouseLinks) {
    await syncSkladchikWarehouseLinks(tenantId, skladchikId, normalizePositiveIntIds(input.warehouse_ids ?? []));
  }

  if (Object.keys(data).length > 0 || touchWarehouseLinks || touchEntitlements) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.user,
      entityId: skladchikId,
      action: "patch.skladchik",
      payload: {
        keys: [
          ...Object.keys(data).filter((k) => k !== "password_hash"),
          ...(touchWarehouseLinks ? ["warehouse_ids"] : []),
          ...(touchEntitlements ? ["warehouse_staff_entitlements"] : [])
        ]
      }
    });
  }

  const rows = await listStaff(tenantId, "skladchik");
  const row = rows.find((x) => x.id === skladchikId);
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

