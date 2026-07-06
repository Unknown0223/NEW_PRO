/**
 * Mobil ilova (agent / supervisor / expeditor) uchun test tenantda rol ruxsatlari.
 * Ishga tushirish: npx tsx scripts/ensure-mobile-role-permissions.ts [slug]
 */
import { prisma } from "../src/config/database";
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

async function main() {
  const slug = (process.argv[2] ?? "test1").trim();
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`Tenant topilmadi: ${slug}`);
    process.exit(1);
  }

  await ensureTenantRolesForRoleDefaults(tenant.id);
  await syncTenantUserRolesFromProfile(tenant.id);

  for (const roleKey of MOBILE_ROLES) {
    const role = await ensureRoleByKey(tenant.id, roleKey);
    await setRolePermissions(tenant.id, role.id, [...MOBILE_PERMISSION_KEYS]);
    console.log(`✓ ${slug} / ${roleKey}: ${MOBILE_PERMISSION_KEYS.length} ruxsat`);
  }

  console.log("\nTayyor. Mobil ilovada qayta login qiling.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
