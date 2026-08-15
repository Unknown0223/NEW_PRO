/**
 * Mavjud rol ruxsatlariga yangi preset kalitlarini qo'shadi (o'chirmaydi).
 * npx tsx scripts/merge-role-default-keys.ts
 */
import { prisma } from "../src/config/database";
import { syncDefaultPermissionMetadata } from "../src/modules/access/permission-catalog.service";
import { ensureRoleByKey, ensureTenantRolesForRoleDefaults } from "../src/modules/access/rbac.roles";
import { buildRoleDefaultKeys, rolesWithPresets } from "../src/modules/access/role-permission-presets";

async function mergeTenant(tenantId: number, slug: string) {
  await syncDefaultPermissionMetadata(tenantId);
  await ensureTenantRolesForRoleDefaults(tenantId);
  let addedTotal = 0;
  for (const roleKey of rolesWithPresets()) {
    const want = buildRoleDefaultKeys(roleKey);
    if (!want.length) continue;
    const role = await ensureRoleByKey(tenantId, roleKey);
    const perms = await prisma.permission.findMany({
      where: { tenant_id: tenantId, key: { in: want } },
      select: { id: true, key: true }
    });
    const byKey = new Map(perms.map((p) => [p.key, p.id]));
    const existing = await prisma.rolePermission.findMany({
      where: { role_id: role.id },
      select: { permission_id: true }
    });
    const have = new Set(existing.map((e) => e.permission_id));
    const toCreate: { role_id: number; permission_id: number }[] = [];
    for (const key of want) {
      const pid = byKey.get(key);
      if (pid && !have.has(pid)) toCreate.push({ role_id: role.id, permission_id: pid });
    }
    if (toCreate.length) {
      await prisma.rolePermission.createMany({ data: toCreate, skipDuplicates: true });
      addedTotal += toCreate.length;
      console.log(`  + ${roleKey}: ${toCreate.length} yangi`);
    }
  }
  console.log(`✓ ${slug}: ${addedTotal} kalit qo'shildi`);
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  for (const t of tenants) await mergeTenant(t.id, t.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
