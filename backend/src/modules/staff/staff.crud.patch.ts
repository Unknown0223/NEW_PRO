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
import { listStaff } from "./staff.crud.list";

export async function patchAgentSupervisor(
  tenantId: number,
  agentUserId: number,
  supervisorUserId: number | null,
  actorUserId: number | null = null
): Promise<StaffRow> {
  const agent = await prisma.user.findFirst({
    where: { id: agentUserId, tenant_id: tenantId, role: "agent" }
  });
  if (!agent) {
    throw new Error("NOT_FOUND");
  }

  if (supervisorUserId != null) {
    if (supervisorUserId === agentUserId) {
      throw new Error("SELF_SUPERVISOR");
    }
    const sup = await prisma.user.findFirst({
      where: { id: supervisorUserId, tenant_id: tenantId, is_active: true, role: "supervisor" }
    });
    if (!sup) {
      throw new Error("BAD_SUPERVISOR");
    }
  }

  await prisma.user.update({
    where: { id: agentUserId },
    data: {
      supervisor:
        supervisorUserId == null ? { disconnect: true } : { connect: { id: supervisorUserId } }
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: agentUserId,
    action: "patch.supervisor",
    payload: { supervisor_user_id: supervisorUserId }
  });

  const rows = await listStaff(tenantId, "agent");
  const row = rows.find((x) => x.id === agentUserId);
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  return row;
}
export async function getStaffRow(tenantId: number, kind: StaffKind, id: number): Promise<StaffRow | null> {
  const rows = await listStaff(tenantId, kind);
  return rows.find((r) => r.id === id) ?? null;
}

export type PatchAgentInput = {
  first_name?: string;
  last_name?: string | null;
  middle_name?: string | null;
  phone?: string | null;
  email?: string | null;
  product?: string | null;
  agent_type?: string | null;
  code?: string | null;
  pinfl?: string | null;
  consignment?: boolean;
  consignment_limit_amount?: string | null;
  consignment_ignore_previous_months_debt?: boolean;
  apk_version?: string | null;
  device_name?: string | null;
  can_authorize?: boolean;
  price_type?: string | null;
  agent_price_types?: string[];
  warehouse_id?: number | null;
  return_warehouse_id?: number | null;
  trade_direction_id?: number | null;
  trade_direction?: string | null;
  branch?: string | null;
  position?: string | null;
  app_access?: boolean;
  territory?: string | null;
  is_active?: boolean;
  password?: string;
  max_sessions?: number;
  kpi_color?: string | null;
  agent_entitlements?: AgentEntitlements;
  supervisor_user_id?: number | null;
};

/** DB + audit; без `listStaff` — для массовых операций. */

