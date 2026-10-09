import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import type { FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { buildScopedStaffDirectoryWhereForActor } from "../access/access-agent-scope";

export const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
export const adminRoles = ["admin"] as const;

export async function accessStaffDirectoryWhere(
  request: FastifyRequest,
  tenantId: number
): Promise<Prisma.UserWhereInput | null> {
  const actor = getAccessUser(request);
  return buildScopedStaffDirectoryWhereForActor(tenantId, {
    userId: actorUserIdOrNull(request),
    role: actor.role ?? ""
  });
}
