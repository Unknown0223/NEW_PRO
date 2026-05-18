import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { WAREHOUSE_LINK_ROLES, type WarehouseLinkRole } from "./reference.warehouse.types";

const ROLE_FOR_WAREHOUSE_LINK: Record<WarehouseLinkRole, string> = {
  agent: "agent",
  cashier: "operator",
  manager: "operator",
  operator: "operator",
  storekeeper: "operator",
  supervisor: "supervisor",
  expeditor: "expeditor"
};

export async function assertWarehouseLinkRoles(
  tenantId: number,
  links: { user_id: number; link_role: string }[]
) {
  if (!links.length) return;
  const userIds = [...new Set(links.map((l) => l.user_id))];
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: userIds } },
    select: { id: true, role: true }
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  for (const l of links) {
    const u = byId.get(l.user_id);
    if (!u) throw new Error("UserNotFound");
    const role = l.link_role as WarehouseLinkRole;
    if (!WAREHOUSE_LINK_ROLES.includes(role)) throw new Error("InvalidLinkRole");
    const need = ROLE_FOR_WAREHOUSE_LINK[role];
    if (u.role !== need) throw new Error("UserRoleMismatch");
  }
}
