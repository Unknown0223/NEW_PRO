/**
 * «Данные Город» Excel → Zona / Oblast / Gorod (to‘liq hudud spravochnigi).
 *
 *   npm run import:gorod-xlsx -- "C:\Users\...\Downloads\Данные Город (1).xlsx"
 *
 *   IMPORT_TENANT_SLUG=test1          (standart: test1)
 *   CITY_XLSX_PATH yoki GOROD_XLSX_PATH  (ixtiyoriy)
 *   IMPORT_GOROD_DRY_RUN=1            — faqat hisobot
 *   Production: ALLOW_PROD_GOROD_IMPORT=true
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { resolveGorodXlsxPath, runGorodXlsxImport } from "./lib/gorod-xlsx-import";

const prisma = new PrismaClient();

function truthy(v: string | undefined): boolean {
  return v === "1" || v === "true" || v === "yes";
}

async function main() {
  const dry = truthy(process.env.IMPORT_GOROD_DRY_RUN) || truthy(process.env.IMPORT_TERRITORY_DRY_RUN);
  const slug = (process.env.IMPORT_TENANT_SLUG || "test1").trim();
  const cliPath = process.argv.slice(2).find((a) => !a.startsWith("-"));
  const xlsxPath = resolveGorodXlsxPath(process.cwd(), cliPath);

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    const list = await prisma.tenant.findMany({
      select: { slug: true },
      take: 30,
      orderBy: { id: "asc" }
    });
    throw new Error(
      `Tenant topilmadi: slug="${slug}". ` +
        (list.length ? `Mavjud: ${list.map((t) => t.slug).join(", ")}` : "Bazada tenant yo‘q.")
    );
  }

  const allowProd =
    truthy(process.env.ALLOW_PROD_GOROD_IMPORT) ||
    truthy(process.env.ALLOW_PROD_TERRITORY_EXCEL) ||
    truthy(process.env.ALLOW_PROD_CITIES_IMPORT) ||
    truthy(process.env.ALLOW_PROD_REF_IMPORT);

  await runGorodXlsxImport({
    prisma,
    tenantId: tenant.id,
    tenantSlug: slug,
    xlsxPath,
    dry,
    allowProdWrite: allowProd
  });

  if (dry) {
    console.log("\n→ DRY-RUN. Yozish: IMPORT_GOROD_DRY_RUN o‘chirilgan holda qayta ishga tushiring.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
