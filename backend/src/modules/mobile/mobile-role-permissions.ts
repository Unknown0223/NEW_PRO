import { ensureRoleByKey, ensureTenantRolesForRoleDefaults } from "../access/rbac.roles";
import { setRolePermissions } from "../access/rbac.permissions";

/** Mobil ilova API uchun minimal RBAC kalitlari (agent / supervisor / expeditor). */
export const MOBILE_ROLE_PERMISSION_KEYS = [
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

export const MOBILE_APP_ROLES = ["agent", "supervisor", "expeditor"] as const;

/** Tenant uchun mobil rollar ruxsatlarini kafolatlaydi (idempotent). */
export async function ensureMobileRolePermissions(tenantId: number): Promise<void> {
  await ensureTenantRolesForRoleDefaults(tenantId);
  for (const roleKey of MOBILE_APP_ROLES) {
    const role = await ensureRoleByKey(tenantId, roleKey);
    await setRolePermissions(tenantId, role.id, [...MOBILE_ROLE_PERMISSION_KEYS]);
  }
}
