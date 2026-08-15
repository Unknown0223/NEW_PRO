/**
 * Access «Операции» da lotincha/orphan ko‘rinadigan yaroqsiz kalitlarni topadi (va ixtiyoriy tozalaydi).
 *
 *   npx tsx scripts/cleanup-orphan-permissions.ts           # faqat hisobot
 *   npx tsx scripts/cleanup-orphan-permissions.ts --apply   # migratsiya + o‘chirish + sync
 */
import { prisma } from "../src/config/database";
import { buildStructuredPermissionCatalog } from "../src/modules/access/permission-model";
import { LEGACY_PERMISSION_METADATA } from "../src/modules/access/legacy-permissions.generated";
import { DEFAULT_PERMISSION_METADATA } from "../src/modules/access/permission-catalog";

const apply = process.argv.includes("--apply");

const structuredKeys = new Set(buildStructuredPermissionCatalog().map((e) => e.key));
const legacyKeys = new Set(Object.keys(LEGACY_PERMISSION_METADATA));
const defaultKeys = new Set(Object.keys(DEFAULT_PERMISSION_METADATA));

/** UNKNOWN → kanonik kalitlar (rol/user grantlar ko‘chiriladi, so‘ng orphan o‘chiriladi). */
const MIGRATE_UNKNOWN_TO: Record<string, string[]> = {
  "cash.view": ["cash.kassa.view"],
  "clients.view": ["clients.klient.view"],
  "suppliers.view": ["suppliers.postavshchik.view"],
  "orders.status.update": ["orders.zakaz.status"],
  "reports.otchety.create": ["reports.konstruktor.create"],
  "reports.otchety.update": ["reports.konstruktor.update"],
  "clients.oborudovanie.status": ["clients.oborudovanie.update"],
  "clients.oborudovanie.transfer": ["clients.oborudovanie.update"],
  "staff.agent.status": ["staff.agent.activate", "staff.agent.deactivate"],
  "staff.auditor.status": ["staff.auditor.activate", "staff.auditor.deactivate"],
  "staff.ekspeditor.status": ["staff.ekspeditor.activate", "staff.ekspeditor.deactivate"],
  "staff.inkassator.status": ["staff.inkassator.activate", "staff.inkassator.deactivate"],
  "staff.supervayzer.status": ["staff.supervayzer.activate", "staff.supervayzer.deactivate"],
  "staff.sotrudniki.status": ["staff.sotrudniki.activate", "staff.sotrudniki.deactivate"],
  "staff.kpi.update": ["staff.kpi.create"],
  "staff.zarplaty.assign": ["staff.zarplaty.create"],
  "staff.zarplaty.update": ["staff.zarplaty.create"]
};

function isKnownCatalogKey(key: string): boolean {
  if (structuredKeys.has(key) || legacyKeys.has(key) || defaultKeys.has(key)) return true;
  if (key.startsWith("access.grant.")) {
    const inner = key.slice("access.grant.".length);
    return (
      structuredKeys.has(inner) ||
      legacyKeys.has(inner) ||
      defaultKeys.has(inner) ||
      inner === "access.manage" ||
      inner === "users.manage" ||
      inner === "audit.view"
    );
  }
  return false;
}

function looksOrphanDisplay(key: string, description: string | null, section: string | null): boolean {
  const desc = (description ?? "").trim();
  const sec = (section ?? "").trim();
  if (!desc && !sec) return true;
  if (desc === key) return true;
  if (/^[a-z][a-z0-9_.]*$/i.test(desc) && desc.includes(".")) return true;
  return false;
}

function metaForKey(key: string): { description: string; section: string; module: string; action: string } {
  const structured = buildStructuredPermissionCatalog().find((e) => e.key === key);
  if (structured) {
    return {
      description: structured.description,
      section: structured.sectionLabel,
      module: structured.module,
      action: structured.action
    };
  }
  const legacy = LEGACY_PERMISSION_METADATA[key];
  if (legacy) {
    const parts = key.split(".");
    return {
      description: legacy.description,
      section: legacy.section,
      module: parts[0] ?? "misc",
      action: parts[parts.length - 1] ?? "view"
    };
  }
  const def = DEFAULT_PERMISSION_METADATA[key];
  if (def) {
    const parts = key.split(".");
    return {
      description: def.description,
      section: def.section,
      module: parts[0] ?? "misc",
      action: parts[parts.length - 1] ?? "view"
    };
  }
  const parts = key.split(".");
  return {
    description: key,
    section: parts.slice(0, -1).join(".") || key,
    module: parts[0] ?? "misc",
    action: parts[parts.length - 1] ?? "view"
  };
}

async function ensurePermission(tenantId: number, key: string): Promise<number> {
  const existing = await prisma.permission.findFirst({
    where: { tenant_id: tenantId, key },
    select: { id: true }
  });
  if (existing) return existing.id;
  const m = metaForKey(key);
  const created = await prisma.permission.create({
    data: {
      tenant_id: tenantId,
      key,
      module: m.module,
      section: m.section,
      description: m.description,
      action: m.action
    },
    select: { id: true }
  });
  return created.id;
}

async function migrateGrants(fromPermId: number, tenantId: number, toKeys: string[]) {
  const roleLinks = await prisma.rolePermission.findMany({
    where: { permission_id: fromPermId },
    select: { role_id: true }
  });
  const userLinks = await prisma.userPermission.findMany({
    where: { permission_id: fromPermId },
    select: { user_id: true }
  });

  for (const targetKey of toKeys) {
    const targetId = await ensurePermission(tenantId, targetKey);
    if (roleLinks.length) {
      await prisma.rolePermission.createMany({
        data: roleLinks.map(({ role_id }) => ({ role_id, permission_id: targetId })),
        skipDuplicates: true
      });
    }
    if (userLinks.length) {
      await prisma.userPermission.createMany({
        data: userLinks.map(({ user_id }) => ({ user_id, permission_id: targetId })),
        skipDuplicates: true
      });
    }
  }
}

async function main() {
  const rows = await prisma.permission.findMany({
    select: {
      id: true,
      tenant_id: true,
      key: true,
      module: true,
      section: true,
      description: true,
      action: true,
      _count: { select: { users: true, roles: true } }
    },
    orderBy: [{ tenant_id: "asc" }, { key: "asc" }]
  });

  const suspects = rows.filter((r) => {
    const unknown = !isKnownCatalogKey(r.key);
    const orphanMeta = looksOrphanDisplay(r.key, r.description, r.section);
    return unknown || orphanMeta;
  });

  const unknown = suspects.filter((r) => !isKnownCatalogKey(r.key));
  const emptyMetaKnown = suspects.filter(
    (r) => isKnownCatalogKey(r.key) && looksOrphanDisplay(r.key, r.description, r.section)
  );

  console.log(`Jami permission: ${rows.length}`);
  console.log(`Shubhali: ${suspects.length}`);
  console.log(`  • katalogda yo‘q: ${unknown.length}`);
  console.log(`  • katalogda bor, lekin description/section bo‘sh: ${emptyMetaKnown.length}`);
  console.log("");

  const byKey = new Map<string, typeof suspects>();
  for (const r of suspects) {
    const arr = byKey.get(r.key) ?? [];
    arr.push(r);
    byKey.set(r.key, arr);
  }

  const sortedKeys = [...byKey.keys()].sort((a, b) => a.localeCompare(b));
  for (const key of sortedKeys) {
    const list = byKey.get(key)!;
    const roles = list.reduce((s, x) => s + x._count.roles, 0);
    const users = list.reduce((s, x) => s + x._count.users, 0);
    const reason = !isKnownCatalogKey(key) ? "UNKNOWN" : "EMPTY_META";
    const migrate = MIGRATE_UNKNOWN_TO[key];
    const migNote = migrate ? `  → ${migrate.join(", ")}` : "";
    console.log(
      `[${reason}] ${key}  tenants=${list.length}  roles=${roles}  users=${users}  desc=${JSON.stringify(list[0]?.description)}  section=${JSON.stringify(list[0]?.section)}${migNote}`
    );
  }

  if (!apply) {
    console.log("\nFaqat hisobot. O‘chirish: npx tsx scripts/cleanup-orphan-permissions.ts --apply");
    return;
  }

  // 1) UNKNOWN grantlarni kanonik kalitlarga ko‘chirish
  let migrated = 0;
  for (const r of unknown) {
    const targets = MIGRATE_UNKNOWN_TO[r.key];
    if (!targets?.length) continue;
    if (r._count.roles === 0 && r._count.users === 0) continue;
    await migrateGrants(r.id, r.tenant_id, targets);
    migrated += 1;
    console.log(`migrate: tenant=${r.tenant_id} ${r.key} → ${targets.join(", ")}`);
  }
  console.log(`Migratsiya qilingan permission yozuvlari: ${migrated}`);

  // 2) UNKNOWN + bog‘lanmagan EMPTY_META access.grant o‘chirish
  const toDelete = suspects.filter((r) => {
    if (!isKnownCatalogKey(r.key)) return true;
    if (r.key.startsWith("access.grant.") && r._count.roles === 0 && r._count.users === 0) {
      return true;
    }
    return false;
  });

  const ids = toDelete.map((r) => r.id);
  if (ids.length === 0) {
    console.log("\nO‘chirish uchun yozuv yo‘q (EMPTY_META known — sync bilan tuzatiladi).");
  } else {
    const rp = await prisma.rolePermission.deleteMany({ where: { permission_id: { in: ids } } });
    const up = await prisma.userPermission.deleteMany({ where: { permission_id: { in: ids } } });
    const del = await prisma.permission.deleteMany({ where: { id: { in: ids } } });
    console.log(
      `\nO‘chirildi: permissions=${del.count}, role_links=${rp.count}, user_links=${up.count}`
    );
  }

  // 3) Known EMPTY_META — sync
  const { syncDefaultPermissionMetadata } = await import(
    "../src/modules/access/permission-catalog.service"
  );
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  for (const t of tenants) {
    await syncDefaultPermissionMetadata(t.id);
    console.log(`sync: ${t.slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
