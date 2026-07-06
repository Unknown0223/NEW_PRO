/**
 * Tenant uchun RBAC: rol katalogi, user_roles bog‘lanishi, admin/operator/agent ruxsatlari.
 * npx tsx scripts/ensure-rbac-tenant.ts [slug]
 */
import { prisma } from "../src/config/database";
import { syncDefaultPermissionMetadata } from "../src/modules/access/permission-catalog.service";
import {
  ensureRoleByKey,
  ensureTenantRolesForRoleDefaults,
  syncTenantUserRolesFromProfile
} from "../src/modules/access/rbac.roles";
import { setRolePermissions } from "../src/modules/access/rbac.permissions";

const MOBILE_PERMISSION_KEYS = [
  "orders.view",
  "orders.create",
  "orders.zakaz.spisok_zakazov",
  "orders.zakaz.prosmotr_zakaza",
  "orders.zakaz.sozdanie_zakaza",
  "clients.spisok_klientov",
  "clients.prosmotr_profilya_klienta",
  "staff.agent.konfiguratsii",
  "staff.agent.prosmotr_agenta",
  "warehouse.view",
  "dashboard.view",
  "dashboard.supervayzer",
  "dashboard.prodazhi"
] as const;

const MOBILE_ROLES = ["agent", "supervisor", "expeditor"] as const;

async function grantRoleAllCatalogKeys(tenantId: number, roleKey: string, exceptKeys: string[] = []) {
  await syncDefaultPermissionMetadata(tenantId);
  const except = new Set(exceptKeys);
  const rows = await prisma.permission.findMany({
    where: { tenant_id: tenantId },
    select: { key: true }
  });
  const keys = rows.map((r) => r.key).filter((k) => !except.has(k));
  const role = await ensureRoleByKey(tenantId, roleKey);
  await setRolePermissions(tenantId, role.id, keys);
  return keys.length;
}

async function main() {
  const slug = (process.argv[2] ?? "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant topilmadi: ${slug}`);
    process.exit(1);
  }

  await ensureTenantRolesForRoleDefaults(tenant.id);
  const linked = await syncTenantUserRolesFromProfile(tenant.id);
  console.log(`✓ ${slug}: ${linked} foydalanuvchi → user_roles`);

  const adminN = await grantRoleAllCatalogKeys(tenant.id, "admin");
  console.log(`✓ admin: ${adminN} ruxsat (katalog)`);

  const operatorN = await grantRoleAllCatalogKeys(tenant.id, "operator", ["access.manage"]);
  console.log(`✓ operator: ${operatorN} ruxsat (access.manage dan tashqari)`);

  for (const roleKey of MOBILE_ROLES) {
    const role = await ensureRoleByKey(tenant.id, roleKey);
    await setRolePermissions(tenant.id, role.id, [...MOBILE_PERMISSION_KEYS]);
    console.log(`✓ ${roleKey}: ${MOBILE_PERMISSION_KEYS.length} mobil ruxsat`);
  }

  console.log("\nTayyor. Veb/mobil: chiqib qayta login qiling.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
