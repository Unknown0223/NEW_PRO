/**
 * Barcha ma'lumotlarni tozalash (schema o'zgarmaydi):
 * - public sxemadagi barcha jadvallar TRUNCATE qilinadi
 * - identity (autoincrement) reset bo'ladi
 * - FK bog'lanishlar uchun CASCADE ishlatiladi
 *
 * Eslatma: `_prisma_migrations` saqlab qolinadi.
 *
 * Himoya (ikkala bosqich majburiy):
 *   CONFIRM_TRUNCATE=YES
 *   --confirm-phrase=DELETE_ALL_DATA
 *   --backup-ok
 *
 * PowerShell:
 *   $env:CONFIRM_TRUNCATE="YES"
 *   npx tsx scripts/db-truncate-all-once.ts --confirm-phrase=DELETE_ALL_DATA --backup-ok
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  assertOpsDestructiveGate,
  tryAppendOpsPurgeAudit
} from "./lib/ops-destructive-gate";

const prisma = new PrismaClient();

async function main() {
  const gate = assertOpsDestructiveGate({
    scriptName: "db-truncate-all-once",
    altConfirmEnv: "CONFIRM_DB_WIPE_ALL"
  });
  if (!gate.ok) {
    console.error(gate.message);
    process.exit(1);
  }

  // Best-effort: birinchi tenant uchun ops.purge (truncate hammasi o‘chadi).
  const anyTenant = await prisma.tenant.findFirst({ select: { id: true, slug: true } });
  if (anyTenant) {
    await tryAppendOpsPurgeAudit({
      prisma,
      tenantId: anyTenant.id,
      script: "db-truncate-all-once",
      detail: { tenant_slug: anyTenant.slug, note: "pre-truncate marker (will be wiped)" }
    });
  } else {
    console.warn("[db-truncate-all-once] Tenant yo‘q — ops.purge yozilmadi.");
  }

  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  `;

  if (rows.length === 0) {
    console.log("[db-truncate-all-once] Jadval topilmadi.");
    await prisma.$disconnect();
    return;
  }

  const tables = rows.map((r) => `"public"."${r.tablename.replace(/"/g, "\"\"")}"`).join(", ");
  const sql = `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`;

  console.log(`[db-truncate-all-once] Tozalanadigan jadvallar: ${rows.length}`);
  await prisma.$executeRawUnsafe(sql);
  console.log("[db-truncate-all-once] Tayyor. Barcha ma'lumotlar o'chirildi.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
