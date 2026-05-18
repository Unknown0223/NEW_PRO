import { prisma } from "../../config/database";

export async function syncUserRoleLink(
  tenantId: number,
  userId: number,
  roleKey: string
): Promise<void> {
  const role = await prisma.role.upsert({
    where: { tenant_id_key: { tenant_id: tenantId, key: roleKey } },
    create: { tenant_id: tenantId, key: roleKey, name: roleKey },
    update: { name: roleKey }
  });
  await prisma.userRole.createMany({
    data: [{ user_id: userId, role_id: role.id }],
    skipDuplicates: true
  });
}
