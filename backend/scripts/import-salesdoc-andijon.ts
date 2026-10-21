/**
 * Andijon SalesDoc papkasini tenant aksit (id 1) ga idempotent yuklaydi.
 * npx tsx scripts/import-salesdoc-andijon.ts [papka]
 */
import { prisma } from "../src/config/database";
import { loadSalesDoc } from "./lib/salesdoc-andijon-load";
import { applyAndijonStaff } from "./lib/salesdoc-andijon-staff";
import { applyAndijonDocs } from "./lib/salesdoc-andijon-docs";
import { applyAndijonLive } from "./lib/salesdoc-andijon-live";
import { applyClientDebtFile } from "./lib/salesdoc-client-debt";
import { applySalesDocPriceCatalog } from "./lib/salesdoc-price-catalog";

const DEFAULT_ROOT = "C:\\Users\\UNKNOWN_007\\Desktop\\salesdoc-andijon";

async function main() {
  const root = process.argv[2] ?? DEFAULT_ROOT;
  if (process.env.SALESDOC_PRICE_ONLY === "1") {
    const only = loadSalesDoc(root);
    console.log(JSON.stringify(await applySalesDocPriceCatalog(prisma, only.priceTypes)));
    return;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: 1 }, select: { id: true, slug: true } });
  if (!tenant || (tenant.slug !== "aksit" && tenant.slug !== "test1")) {
    throw new Error("tenant id 1 aksit yoki test1 emas — to‘xtatildi");
  }
  const data = loadSalesDoc(root);
  const staff = await applyAndijonStaff(prisma, data);
  const docs = await applyAndijonDocs(prisma, data, staff);
  const live = await applyAndijonLive(prisma, data, staff);
  const debts = await applyClientDebtFile(prisma, root);
  const priceTypes = await applySalesDocPriceCatalog(prisma, data.priceTypes);
  const verify = await prisma.$queryRaw<
    { users: number; clients: number; orders: number; payments: number }[]
  >`
    SELECT
      (SELECT count(*)::int FROM users u
        WHERE u.tenant_id = 1 AND (u.branch = 'Andijon' OR u.code LIKE 'SD%' OR u.code LIKE 'PMAND%')) AS users,
      (SELECT count(*)::int FROM clients c
        WHERE c.tenant_id = 1 AND (c.region ILIKE '%andij%' OR c.client_code LIKE 'a0_%')) AS clients,
      (SELECT count(*)::int FROM orders o WHERE o.tenant_id = 1 AND o.number LIKE 'd0_%') AS orders,
      (SELECT count(*)::int FROM client_payments p WHERE p.tenant_id = 1 AND strpos(p.number, '_') > 0) AS payments
  `;
  console.log(
    JSON.stringify(
      {
        staff: staff.stats,
        docs: docs.counts,
        live,
        debts,
        priceTypes,
        skipped: docs.skipped,
        emptyMonths: data.skippedEmptyMonths,
        verify: verify[0]
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
