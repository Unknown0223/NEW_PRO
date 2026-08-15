/**
 * Rol bo'yicha default ruxsatlarni (strukturali CRUD kalitlar) seed qiladi.
 *
 *   npx tsx scripts/seed-role-defaults.ts [slug]            # bitta tenant
 *   npx tsx scripts/seed-role-defaults.ts --all             # barcha tenantlar
 *   npx tsx scripts/seed-role-defaults.ts [slug] --force    # mavjud rol ruxsatlarini ham qayta yozish
 *
 * Default: faqat ruxsati BO'SH rollarni to'ldiradi (admin sozlamalarini buzmaslik uchun).
 */
import { prisma } from "../src/config/database";
import { syncDefaultPermissionMetadata } from "../src/modules/access/permission-catalog.service";
import { ensureRoleByKey, ensureTenantRolesForRoleDefaults } from "../src/modules/access/rbac.roles";
import { setRolePermissions, stripGrantDelegationKeysFromRoles } from "../src/modules/access/rbac.permissions";
import { buildRoleDefaultKeys, rolesWithPresets } from "../src/modules/access/role-permission-presets";

async function seedTenant(tenantId: number, slug: string, force: boolean) {
  await syncDefaultPermissionMetadata(tenantId);
  await ensureTenantRolesForRoleDefaults(tenantId);
  const stripped = await stripGrantDelegationKeysFromRoles(tenantId);
  if (stripped > 0) console.log(`  • stripped access.grant.* from roles: ${stripped}`);

  let touched = 0;
  for (const roleKey of rolesWithPresets()) {
    const keys = buildRoleDefaultKeys(roleKey);
    if (keys.length === 0) continue;
    const role = await ensureRoleByKey(tenantId, roleKey);
    const existing = await prisma.rolePermission.count({ where: { role_id: role.id } });
    if (existing > 0 && !force) continue;
    await setRolePermissions(tenantId, role.id, keys);
    touched += 1;
    console.log(`  • ${roleKey}: ${keys.length} ruxsat`);
  }
  console.log(`✓ ${slug}: ${touched} rol yangilandi`);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const slugArg = args.find((a) => !a.startsWith("--"));
  const tenants =
    slugArg && slugArg !== "--all"
      ? await prisma.tenant.findMany({ where: { slug: slugArg }, select: { id: true, slug: true } })
      : await prisma.tenant.findMany({ select: { id: true, slug: true } });

  if (tenants.length === 0) {
    console.error(slugArg ? `Tenant topilmadi: ${slugArg}` : "Tenantlar yo'q");
    process.exit(1);
  }
  for (const t of tenants) await seedTenant(t.id, t.slug, force);
  console.log(`\nTayyor. tenants=${tenants.length}, force=${force}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
