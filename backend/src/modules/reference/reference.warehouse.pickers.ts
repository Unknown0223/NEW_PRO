import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";
import { buildScopedAgentDirectoryWhereForActor } from "../access/access-agent-scope";
import { warehouseDetailSelect } from "./reference.warehouse.constants";

export async function listWarehousePickers(
  tenantId: number,
  actor?: { userId: number | null; role: string }
) {
  const agentScope = await buildScopedAgentDirectoryWhereForActor(tenantId, actor);
  const agentWhere: Prisma.UserWhereInput = {
    tenant_id: tenantId,
    is_active: true,
    role: "agent",
    ...(agentScope ? { AND: [agentScope] } : {})
  };
  const [agents, operators, supervisors, expeditors] = await Promise.all([
    prisma.user.findMany({
      where: agentWhere,
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { login: "asc" }]
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: { in: [...OPERATOR_LIKE_WEB_ROLES] } },
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { login: "asc" }]
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: "supervisor" },
      select: { id: true, name: true, login: true },
      orderBy: [{ name: "asc" }, { login: "asc" }]
    }),
    prisma.user.findMany({
      where: { tenant_id: tenantId, is_active: true, role: "expeditor" },
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
