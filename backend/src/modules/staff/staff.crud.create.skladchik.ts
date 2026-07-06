import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { CreateStaffInput, StaffRow } from "./staff.shared";
import {
  SKLADCHIK_WAREHOUSE_LINK_ROLE,
  assertWarehousesBelongToTenant,
  normalizePositiveIntIds
} from "./staff.shared";
import { toPrismaJsonEntitlements } from "./skladchik-entitlements";
import { listStaff } from "./staff.crud.list";
import { syncUserRoleLink } from "./staff.crud.create.shared";

export async function createSkladchikStaff(
  tenantId: number,
  input: CreateStaffInput,
  actorUserId: number | null,
  login: string,
  firstName: string
): Promise<StaffRow> {
  const passwordHashSk = await bcrypt.hash(input.password, 10);
  const ms =
    input.max_sessions != null && Number.isInteger(input.max_sessions) && input.max_sessions >= 1
      ? input.max_sessions
      : 1;
  const whIds = normalizePositiveIntIds(input.warehouse_ids ?? []);
  await assertWarehousesBelongToTenant(tenantId, whIds);
  const displayName = [input.last_name, input.first_name, input.middle_name]
    .filter((x) => x && String(x).trim().length > 0)
    .join(" ")
    .trim();
  const primaryWhId = whIds.length > 0 ? whIds[0]! : null;

  const createdSk = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: displayName || firstName,
      first_name: firstName,
      last_name: input.last_name?.trim() || null,
      middle_name: input.middle_name?.trim() || null,
      login,
      password_hash: passwordHashSk,
      role: "skladchik",
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      can_authorize: input.can_authorize ?? true,
      is_active: input.is_active ?? true,
      app_access: input.app_access ?? false,
      max_sessions: ms,
      product: null,
      agent_type: null,
      code: input.code?.trim().slice(0, 24) || null,
      pinfl: input.pinfl?.trim().slice(0, 24) || null,
      consignment: false,
      apk_version: null,
      device_name: null,
      price_type: null,
      agent_price_types: [],
      agent_entitlements: {},
      warehouse_id: primaryWhId,
      return_warehouse_id: null,
      trade_direction: null,
      branch: input.branch?.trim().slice(0, 128) || null,
      position: input.position?.trim().slice(0, 128) || null,
      territory: null,
      kpi_color: null,
      supervisor_user_id: null,
      warehouse_staff_entitlements: toPrismaJsonEntitlements(input.warehouse_staff_entitlements)
    }
  });
  await syncUserRoleLink(tenantId, createdSk.id, "skladchik");

  if (whIds.length > 0) {
    await prisma.warehouseUserLink.createMany({
      data: whIds.map((warehouse_id) => ({
        warehouse_id,
        user_id: createdSk.id,
        link_role: SKLADCHIK_WAREHOUSE_LINK_ROLE
      }))
    });
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: createdSk.id,
    action: "create",
    payload: {
      role: "skladchik",
      login: createdSk.login,
      password_set: true,
      warehouse_ids: whIds
    }
  });

  const rowsSk = await listStaff(tenantId, "skladchik");
  const rowSk = rowsSk.find((x) => x.id === createdSk.id);
  if (!rowSk) throw new Error("NOT_FOUND");
  return rowSk;
}
