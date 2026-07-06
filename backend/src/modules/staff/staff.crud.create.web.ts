import bcrypt from "bcryptjs";
import { prisma } from "../../config/database";
import { createCashDeskUserLink } from "../cash-desks/cash-desks.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { CreateStaffInput, StaffKind, StaffRow } from "./staff.shared";
import { kindRole } from "./staff.shared";
import { listStaff } from "./staff.crud.list";
import { syncUserRoleLink } from "./staff.crud.create.shared";

export async function createWebStaff(
  tenantId: number,
  kind: StaffKind,
  input: CreateStaffInput,
  actorUserId: number | null,
  login: string,
  firstName: string
): Promise<StaffRow> {
  const dbRole = kindRole(kind);
  if (
    kind !== "operator" &&
    (input.cash_desk_id != null ||
      (input.cash_desk_link_role != null && String(input.cash_desk_link_role).trim() !== ""))
  ) {
    throw new Error("CASH_DESK_OPERATOR_ONLY");
  }
  const passwordHashOp = await bcrypt.hash(input.password, 10);
  const ms =
    input.max_sessions != null && Number.isInteger(input.max_sessions) && input.max_sessions >= 1
      ? input.max_sessions
      : 1;
  const displayName = [input.last_name, input.first_name, input.middle_name]
    .filter((x) => x && String(x).trim().length > 0)
    .join(" ")
    .trim();
  const createdOp = await prisma.user.create({
    data: {
      tenant_id: tenantId,
      name: displayName || firstName,
      first_name: firstName,
      last_name: input.last_name?.trim() || null,
      middle_name: input.middle_name?.trim() || null,
      login,
      password_hash: passwordHashOp,
      role: dbRole,
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
      warehouse_id: null,
      return_warehouse_id: null,
      trade_direction: null,
      branch: input.branch?.trim().slice(0, 128) || null,
      position: input.position?.trim().slice(0, 128) || null,
      territory: null,
      kpi_color: null,
      supervisor_user_id: null
    }
  });
  await syncUserRoleLink(tenantId, createdOp.id, dbRole);

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: AuditEntityType.user,
    entityId: createdOp.id,
    action: "create",
    payload: {
      role: dbRole,
      login: createdOp.login,
      password_set: true
    }
  });

  if (kind === "operator") {
    const deskId = input.cash_desk_id;
    const deskLinkRole = input.cash_desk_link_role;
    if (deskId != null && deskLinkRole) {
      await createCashDeskUserLink(tenantId, deskId, createdOp.id, deskLinkRole);
    }
  }

  const rowsOp = await listStaff(tenantId, "operator");
  const rowOp = rowsOp.find((x) => x.id === createdOp.id);
  if (!rowOp) throw new Error("NOT_FOUND");
  return rowOp;
}
