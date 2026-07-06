/**
 * Eski (legacy) tekis ruxsat kalitlaridagi role/user biriktirishlarni yangi
 * strukturali `<module>.<section>.<action>` kalitlarga KO'CHIRADI (non-destructive).
 *
 *   npx tsx scripts/migrate-permissions-to-crud.ts [slug]   # bitta tenant
 *   npx tsx scripts/migrate-permissions-to-crud.ts --all     # barcha tenantlar
 *
 * Eski kalitlar o'chirilmaydi (orqaga moslik). Faqat yangi kalitlarga
 * mos role_permissions / user_permissions qatorlari qo'shiladi (idempotent).
 */
import { prisma } from "../src/config/database";
import { syncDefaultPermissionMetadata } from "../src/modules/access/permission-catalog.service";
import { mapLegacyKeyToStructured } from "../src/modules/access/legacy-key-map";
import { ensurePermissionIdsForKeys } from "../src/modules/access/rbac.permissions";

async function migrateTenant(tenantId: number, slug: string, prune: boolean) {
  await syncDefaultPermissionMetadata(tenantId);

  const perms = await prisma.permission.findMany({
    where: { tenant_id: tenantId },
    select: { id: true, key: true }
  });
  const idByKey = new Map(perms.map((p) => [p.key, p.id]));

  // Eski kalit id → yangi kalit (mapping mavjud bo'lganlar)
  const oldToNew: { oldId: number; newKey: string }[] = [];
  for (const p of perms) {
    const newKey = mapLegacyKeyToStructured(p.key);
    if (newKey && newKey !== p.key) oldToNew.push({ oldId: p.id, newKey });
  }
  if (oldToNew.length === 0) {
    console.log(`• ${slug}: mapping uchun eski kalit topilmadi`);
    return;
  }

  // Yangi kalitlar uchun id larni kafolatlash
  const newKeys = [...new Set(oldToNew.map((m) => m.newKey))];
  const newIdByKey = await prisma.$transaction((tx) => ensurePermissionIdsForKeys(tx, tenantId, newKeys));
  for (const [k, v] of newIdByKey) idByKey.set(k, v);

  let roleCopied = 0;
  let userCopied = 0;

  for (const { oldId, newKey } of oldToNew) {
    const newId = idByKey.get(newKey);
    if (newId == null || newId === oldId) continue;

    // role_permissions: eski kalitga ega rollar → yangi kalit
    const roleLinks = await prisma.rolePermission.findMany({
      where: { permission_id: oldId },
      select: { role_id: true }
    });
    if (roleLinks.length > 0) {
      const res = await prisma.rolePermission.createMany({
        data: roleLinks.map((r) => ({ role_id: r.role_id, permission_id: newId })),
        skipDuplicates: true
      });
      roleCopied += res.count;
    }

    // user_permissions: effekt (allow/deny) saqlanadi
    const userLinks = await prisma.userPermission.findMany({
      where: { permission_id: oldId },
      select: { user_id: true, effect: true }
    });
    if (userLinks.length > 0) {
      const res = await prisma.userPermission.createMany({
        data: userLinks.map((u) => ({ user_id: u.user_id, permission_id: newId, effect: u.effect })),
        skipDuplicates: true
      });
      userCopied += res.count;
    }
  }

  console.log(
    `✓ ${slug}: ${oldToNew.length} eski kalit → ${newKeys.length} yangi; role+${roleCopied}, user+${userCopied}`
  );

  // --prune: biriktirishlar ko'chirilgach, mos kelgan eski katalog qatorlarini o'chirish.
  if (prune) {
    const oldIds = oldToNew
      .filter(({ oldId, newKey }) => {
        const newId = idByKey.get(newKey);
        return newId != null && newId !== oldId;
      })
      .map((m) => m.oldId);
    if (oldIds.length > 0) {
      const del = await prisma.permission.deleteMany({ where: { id: { in: oldIds } } });
      console.log(`  • prune: ${del.count} eski katalog qatori o'chirildi`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const prune = args.includes("--prune");
  const arg = (args.find((a) => !a.startsWith("--")) ?? "").trim();
  const tenants =
    arg && arg !== "--all"
      ? await prisma.tenant.findMany({ where: { slug: arg }, select: { id: true, slug: true } })
      : await prisma.tenant.findMany({ select: { id: true, slug: true } });

  if (tenants.length === 0) {
    console.error(arg ? `Tenant topilmadi: ${arg}` : "Tenantlar yo'q");
    process.exit(1);
  }
  for (const t of tenants) await migrateTenant(t.id, t.slug, prune);
  console.log(
    `\nTayyor. tenants=${tenants.length}. ${prune ? "Mos kelgan eski kalitlar o'chirildi (--prune)." : "Eski kalitlar saqlandi (non-destructive)."}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
