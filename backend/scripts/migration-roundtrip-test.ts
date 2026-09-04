/**
 * To‘liq migratsiya round-trip: source tenant → ZIP → target tenant.
 *
 *   npx tsx scripts/migration-roundtrip-test.ts
 *   SOURCE_SLUG=test1 TARGET_SLUG=migtest npx tsx scripts/migration-roundtrip-test.ts
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { prisma } from "../src/config/database";
import { buildTenantBackupZip } from "../src/modules/system-migration/system-migration.export";
import { applyBackupZip } from "../src/modules/system-migration/system-migration.import";
import { purgeTenantClientsForReplace } from "../src/modules/system-migration/system-migration.import.purge";
import { isTargetTenantEmptyForImport } from "../src/modules/system-migration/system-migration.inventory";

if (!process.env.DATABASE_URL?.trim()) loadDotenv();

async function countsFor(tenantId: number) {
  const [
    clients,
    products,
    users,
    warehouses,
    cashDesks,
    stock,
    orders,
    payments,
    workSlots,
    bonusRules,
    bonusStrategies,
    bankInbox,
    clientAssignments,
    roles
  ] = await Promise.all([
    prisma.client.count({ where: { tenant_id: tenantId } }),
    prisma.product.count({ where: { tenant_id: tenantId } }),
    prisma.user.count({ where: { tenant_id: tenantId } }),
    prisma.warehouse.count({ where: { tenant_id: tenantId } }),
    prisma.cashDesk.count({ where: { tenant_id: tenantId } }),
    prisma.stock.count({ where: { tenant_id: tenantId } }),
    prisma.order.count({ where: { tenant_id: tenantId } }),
    prisma.payment.count({ where: { tenant_id: tenantId } }),
    prisma.workSlot.count({ where: { tenant_id: tenantId } }),
    prisma.bonusRule.count({ where: { tenant_id: tenantId } }),
    prisma.bonusStrategy.count({ where: { tenant_id: tenantId } }).catch(() => 0),
    prisma.bankTransferInbox.count({ where: { tenant_id: tenantId } }).catch(() => 0),
    prisma.clientAgentAssignment.count({ where: { tenant_id: tenantId } }),
    prisma.role.count({ where: { tenant_id: tenantId } })
  ]);
  return {
    clients,
    products,
    users,
    warehouses,
    cashDesks,
    stock,
    orders,
    payments,
    workSlots,
    bonusRules,
    bonusStrategies,
    bankInbox,
    clientAssignments,
    roles
  };
}

async function ensureTargetTenant(slug: string) {
  const existing = await prisma.tenant.findFirst({ where: { slug } });
  if (existing) return existing;
  return prisma.tenant.create({
    data: {
      slug,
      name: `Migration test (${slug})`,
      plan: "basic",
      is_active: true
    }
  });
}

async function main() {
  const sourceSlug = (process.env.SOURCE_SLUG ?? "test1").trim();
  const targetSlug = (process.env.TARGET_SLUG ?? "migtest").trim();

  const source = await prisma.tenant.findFirst({
    where: { slug: sourceSlug },
    select: { id: true, slug: true, name: true }
  });
  if (!source) throw new Error(`Source tenant yo‘q: ${sourceSlug}`);

  const target = await ensureTargetTenant(targetSlug);
  if (target.id === source.id) throw new Error("Source va target bir xil bo‘lmasin");

  console.log(`[1/5] Source counts ${source.slug}…`);
  const beforeSource = await countsFor(source.id);
  console.log(JSON.stringify(beforeSource, null, 2));

  console.log(`[2/5] Export ZIP…`);
  const t0 = Date.now();
  const buf = await buildTenantBackupZip({
    tenantId: source.id,
    tenantSlug: source.slug
  });
  const outDir = join(process.cwd(), "tmp");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const zipPath = join(outDir, `salec-backup-${source.slug}-roundtrip.zip`);
  writeFileSync(zipPath, buf);
  console.log(`[2/5] ZIP ${buf.length} bytes in ${Date.now() - t0}ms → ${zipPath}`);

  console.log(`[3/5] Empty target ${target.slug}…`);
  const emptyBefore = await isTargetTenantEmptyForImport(target.id);
  if (!emptyBefore.empty) {
    await purgeTenantClientsForReplace(target.id);
    // users/warehouses/slots qolishi mumkin — replace import merge/update qiladi
  }
  console.log(`[3/5] blockers after purge:`, (await isTargetTenantEmptyForImport(target.id)).blockers);

  console.log(`[4/5] Import → ${target.slug}…`);
  const t1 = Date.now();
  const result = await applyBackupZip(buf, target.id, {
    force_nonempty: true,
    mode: "full",
    conflict_policy: "replace",
    actorUserId: null,
    onProgress: (p) => console.log(`  ${p.percent}% ${p.stage}: ${p.message}`)
  });
  console.log(`[4/5] Import done in ${Date.now() - t1}ms`);
  console.log("[warnings]", result.warnings.slice(0, 20));
  if (result.warnings.length > 20) console.log(`  … +${result.warnings.length - 20} more`);
  console.log("[skipped]", result.skipped);
  console.log("[applied files]", result.applied.length);

  console.log(`[5/5] Compare counts…`);
  const afterTarget = await countsFor(target.id);
  const keys = Object.keys(beforeSource) as Array<keyof typeof beforeSource>;
  const diff: Record<string, { source: number; target: number; ok: boolean }> = {};
  let allOk = true;
  for (const k of keys) {
    const s = beforeSource[k];
    const t = afterTarget[k];
    // users: targetda seed admin qolgan bo‘lishi mumkin — >=
    const ok = k === "users" ? t >= s : t === s;
    if (!ok) allOk = false;
    diff[k] = { source: s, target: t, ok };
  }
  console.log(JSON.stringify({ source: beforeSource, target: afterTarget, diff }, null, 2));
  console.log(allOk ? "\nPASS: asosiy sonlar mos" : "\nFAIL: ba’zi sonlar farq qiladi");
  process.exit(allOk ? 0 : 2);
}

main()
  .catch((e) => {
    console.error("ROUNDTRIP XATO:", e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
