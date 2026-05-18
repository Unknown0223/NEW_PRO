import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export async function listUsersForOrderAgent(tenantId: number) {
  return prisma.user.findMany({
    where: { tenant_id: tenantId, is_active: true, role: { not: "supervisor" } },
    orderBy: { login: "asc" },
    select: { id: true, login: true, name: true, role: true, supervisor_user_id: true }
  });
}
