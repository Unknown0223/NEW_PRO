import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { TENANT_ADMIN_ROLE, TENANT_USER_ROLE_KEYS_FOR_DEFAULT_COMPOSITION } from "../../lib/tenant-user-roles";


export async function ensureRoleByKey(tenantId: number, key: string, name?: string) {
  return prisma.role.upsert({
    where: { tenant_id_key: { tenant_id: tenantId, key } },
    create: { tenant_id: tenantId, key, name: name ?? key },
    update: { name: name ?? key }
  });
}

/** RU sarlavhalar — faqat yangi `Role` qatorlari uchun (`update: {}` mavjud nomni buzmaydi). */
const ROLE_DEFAULT_RU_NAMES: Record<string, string> = {
  [TENANT_ADMIN_ROLE]: "Администратор",
  agent: "Агент",
  supervisor: "Супервайзеры",
  operator: "Оператор",
  skladchik: "Складчик",
  cashier: "Кассир",
  auditor: "Аудитор",
  expeditor: "Экспедитор",
  collector: "Сборщик",
  gruzchik: "Грузчик",
  director: "Директор",
  sales_director: "Директор по продажам",
  regional_manager: "Региональный менеджер",
  accountant: "Бухгалтер",
  warehouse_manager: "Заведующий складом",
  manager: "Менеджер",
  storekeeper: "Кладовщик",
  partner: "Партнёр",
  logist: "Логист",
  merchandiser: "Мерчендайзер",
  driver: "Водитель",
  dispatcher: "Диспетчер"
};

/**
 * «Состав ролей по умолчанию» uchun tenant `roles` qatorlarini kafolatlaydi.
 * Avvalgi tenantlarda RBAC migratsiyasi bo‘lmagan bo‘lsa ham ro‘yxat to‘ldiriladi.
 */
/** `users.role` → `user_roles` (Access matritsasi va `me-permissions` uchun). */
export async function syncTenantUserRolesFromProfile(tenantId: number): Promise<number> {
  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, is_active: true },
    select: { id: true, role: true }
  });
  let linked = 0;
  for (const u of users) {
    const roleKey = u.role?.trim();
    if (!roleKey) continue;
    const role = await ensureRoleByKey(tenantId, roleKey);
    await prisma.userRole.deleteMany({ where: { user_id: u.id } });
    await prisma.userRole.create({ data: { user_id: u.id, role_id: role.id } });
    linked += 1;
  }
  return linked;
}

export async function ensureTenantRolesForRoleDefaults(tenantId: number): Promise<void> {
  const distinctUsers = await prisma.user.findMany({
    where: { tenant_id: tenantId },
    distinct: ["role"],
    select: { role: true }
  });
  const keys = new Set<string>();
  for (const k of TENANT_USER_ROLE_KEYS_FOR_DEFAULT_COMPOSITION) keys.add(k);
  for (const { role } of distinctUsers) {
    const t = role?.trim();
    if (t) keys.add(t);
  }
  await Promise.all(
    [...keys].map((key) =>
      prisma.role.upsert({
        where: { tenant_id_key: { tenant_id: tenantId, key } },
        create: {
          tenant_id: tenantId,
          key,
          name: ROLE_DEFAULT_RU_NAMES[key] ?? key,
          is_system: true
        },
        update: {}
      })
    )
  );
}

