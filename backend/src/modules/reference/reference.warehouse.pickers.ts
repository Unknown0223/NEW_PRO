import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";
import {
  buildScopedStaffDirectoryWhere,
  enrichScopedReportActor
} from "../access/access-agent-scope";
import { warehouseDetailSelect } from "./reference.warehouse.constants";

export async function listWarehousePickers(
  tenantId: number,
  actor?: { userId: number | null; role: string }
) {
  const actorScope = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const staffScope = buildScopedStaffDirectoryWhere(actorScope);
  const staffAnd = staffScope ? { AND: [staffScope] } : {};
  const agentWhere: Prisma.UserWhereInput = {
    tenant_id: tenantId,
    is_active: true,
    role: "agent",
    ...staffAnd
  };
  const [agents, operators, supervisors, expeditors] = await Promise.all([
    prisma.user.findMany({
      where: agentWhere,
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { login: "asc" }]
    }),
    prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        role: { in: [...OPERATOR_LIKE_WEB_ROLES] },
        ...staffAnd
      },
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { login: "asc" }]
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: "supervisor", ...staffAnd },
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { login: "asc" }]
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: "expeditor", ...staffAnd },
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { login: "asc" }]
    })
  ]);
  return { agents, operators, supervisors, expeditors };
}

export async function getWarehouseDetail(tenantId: number, id: number) {
  return prisma.warehouse.findFirst({
    where: { id, tenant_id: tenantId },
    select: warehouseDetailSelect
  });
}
