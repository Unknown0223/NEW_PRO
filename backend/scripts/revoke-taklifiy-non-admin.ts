/**
 * plans.taklifiy_reja.* ni admin bo‘lmagan rollardan olib tashlaydi;
 * admin rolida bo‘lmasa qo‘shadi.
 *
 *   npx tsx scripts/revoke-taklifiy-non-admin.ts [slug|--all]
 */
import { prisma } from "../src/config/database";
import { syncDefaultPermissionMetadata } from "../src/modules/access/permission-catalog.service";
import { ensureRoleByKey } from "../src/modules/access/rbac.roles";
import { TENANT_ADMIN_ROLE } from "../src/lib/tenant-user-roles";
import { permissionKey } from "../src/modules/access/permission-model";

const ACTIONS = ["view", "update", "approve", "export"] as const;
const TAKLIFIY_KEYS = ACTIONS.map((a) => permissionKey("plans", "taklifiy_reja", a));

async function ensurePermissionIds(tenantId: number) {
  const ids: number[] = [];
  for (const key of TAKLIFIY_KEYS) {
    const row = await prisma.permission.upsert({
      where: { tenant_id_key: { tenant_id: tenantId, key } },
      create: { tenant_id: tenantId, key, module: "plans" },
      update: {},
      select: { id: true }
    });
    ids.push(row.id);
  }
  return ids;
}

async function runTenant(tenantId: number, slug: string) {
  await syncDefaultPermissionMetadata(tenantId);
  const permissionIds = await ensurePermissionIds(tenantId);

  const roles = await prisma.role.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, key: true }
  });

  let stripped = 0;
  for (const role of roles) {
    if (role.key === TENANT_ADMIN_ROLE) continue;
    const res = await prisma.rolePermission.deleteMany({
      where: { role_id: role.id, permission_id: { in: permissionIds } }
    });
    stripped += res.count;
  }

  const admin = await ensureRoleByKey(tenantId, TENANT_ADMIN_ROLE);
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permission_id) => ({
      role_id: admin.id,
      permission_id
    })),
    skipDuplicates: true
  });

  console.log(`✓ ${slug}: stripped=${stripped}, admin keys=${TAKLIFIY_KEYS.length}`);
}

async function main() {
  const arg = process.argv[2];
  const tenants =
    arg && arg !== "--all"
      ? await prisma.tenant.findMany({ where: { slug: arg }, select: { id: true, slug: true } })
      : await prisma.tenant.findMany({ select: { id: true, slug: true } });
  if (!tenants.length) {
    console.error("Tenant topilmadi");
    process.exit(1);
  }
  for (const t of tenants) await runTenant(t.id, t.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
