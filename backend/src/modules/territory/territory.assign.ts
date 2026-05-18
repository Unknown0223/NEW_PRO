import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";


export async function assignUser(
  tenantId: number,
  territoryId: number,
  userId: number,
  assignedBy?: number
) {
  const territory = await prisma.territory.findFirst({
    where: { id: territoryId, tenant_id: tenantId, deleted_at: null },
    select: { id: true }
  });
  if (!territory) throw new Error("TerritoryNotFound");

  const user = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: { id: true }
  });
  if (!user) throw new Error("UserNotFound");

  try {
    await prisma.territoryUserLink.create({
      data: {
        territory_id: territoryId,
        user_id: userId,
        assigned_by: assignedBy ?? null
      }
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new Error("AlreadyAssigned");
    }
    throw e;
  }
}

/** Remove a user from a territory. Returns true if a link was deleted. */
export async function unassignUser(
  tenantId: number,
  territoryId: number,
  userId: number
) {
  const territory = await prisma.territory.findFirst({
    where: { id: territoryId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!territory) throw new Error("TerritoryNotFound");

  const deleted = await prisma.territoryUserLink.deleteMany({
    where: { territory_id: territoryId, user_id: userId }
  });
  return deleted.count > 0;
}
