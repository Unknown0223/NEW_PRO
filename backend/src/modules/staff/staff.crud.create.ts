import { prisma } from "../../config/database";
import { DISTRIBUTION_WEB_STAFF_ROLES } from "../../lib/tenant-user-roles";
import type { CreateStaffInput, StaffCreateResult, StaffKind } from "./staff.shared";
import { createFieldStaff } from "./staff.crud.create.field";
import { createSkladchikStaff } from "./staff.crud.create.skladchik";
import { createWebStaff } from "./staff.crud.create.web";

export type { SessionRowDto } from "./staff.crud.create.types";

export async function createStaff(
  tenantId: number,
  kind: StaffKind,
  input: CreateStaffInput,
  actorUserId: number | null = null
): Promise<StaffCreateResult> {
  const login = input.login.trim().toLowerCase();
  if (!login) throw new Error("BAD_LOGIN");
  if (input.password.length < 6) throw new Error("BAD_PASSWORD");
  const firstName = input.first_name.trim();
  if (!firstName) throw new Error("BAD_FIRST_NAME");

  const exists = await prisma.user.findFirst({ where: { tenant_id: tenantId, login } });
  if (exists) throw new Error("LOGIN_EXISTS");

  if (kind === "operator" || (DISTRIBUTION_WEB_STAFF_ROLES as readonly string[]).includes(kind)) {
    return createWebStaff(tenantId, kind, input, actorUserId, login, firstName);
  }
  if (kind === "skladchik") {
    return createSkladchikStaff(tenantId, input, actorUserId, login, firstName);
  }
  return createFieldStaff(tenantId, kind, input, actorUserId, login, firstName);
}
