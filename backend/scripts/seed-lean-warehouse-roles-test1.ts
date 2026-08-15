/**
 * test1 uchun faqat skladchik / storekeeper presetlarini yangilaydi (force).
 * Boshqa tenant / rollarga tegmaydi.
 */
import { prisma } from "../src/config/database";
import { ensureRoleByKey } from "../src/modules/access/rbac.roles";
import { setRolePermissions } from "../src/modules/access/rbac.permissions";
import { buildRoleDefaultKeys } from "../src/modules/access/role-permission-presets";

const SLUG = "test1";
const ROLES = ["skladchik", "storekeeper"] as const;

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG }, select: { id: true, slug: true } });
  if (!tenant) throw new Error(`${SLUG} not found`);
  for (const roleKey of ROLES) {
    const keys = buildRoleDefaultKeys(roleKey);
    const role = await ensureRoleByKey(tenant.id, roleKey);
    await setRolePermissions(tenant.id, role.id, keys);
    console.log(`OK ${roleKey}: ${keys.length} keys`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
