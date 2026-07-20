import ExcelJS from "exceljs";
import { prisma } from "../src/config/database";
import { importProductsFromCatalogTemplateXlsx } from "../src/modules/products/products.import.catalog";
import { importProductsCatalogUpdateOnlyXlsx } from "../src/modules/products/products.import.update";

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });
  const cat = await prisma.productCategory.findFirstOrThrow({
    where: { tenant_id: tenant.id, name: "POLKA" }
  });
  const sku = "REACTIVATE-TEST-1";

  const existing = await prisma.product.findUnique({
    where: { tenant_id_sku: { tenant_id: tenant.id, sku } }
  });
  if (existing) {
    await prisma.product.update({ where: { id: existing.id }, data: { is_active: false } });
  } else {
    await prisma.product.create({
      data: {
        tenant_id: tenant.id,
        sku,
        name: "Reactivate me",
        unit: "dona",
        category_id: cat.id,
        is_active: false
      }
    });
  }

  const before = await prisma.product.findUniqueOrThrow({
    where: { tenant_id_sku: { tenant_id: tenant.id, sku } }
  });
  console.log("before is_active=", before.is_active);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import");
  ws.addRow(["Название *", "Код", "Категория *", "Единица измерения (название) *"]);
  ws.addRow(["Reactivate me updated", sku, "POLKA", "dona"]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());

  const result = await importProductsFromCatalogTemplateXlsx(tenant.id, buf, 1);
  console.log("catalog import result", result);
  const after = await prisma.product.findUniqueOrThrow({
    where: { tenant_id_sku: { tenant_id: tenant.id, sku } }
  });
  console.log("after catalog is_active=", after.is_active, "name=", after.name);
  if (!after.is_active) throw new Error("catalog import did not reactivate");

  await prisma.product.update({ where: { id: after.id }, data: { is_active: false } });
  const upd = await importProductsCatalogUpdateOnlyXlsx(tenant.id, buf, 1);
  console.log("update-only result", upd);
  const after2 = await prisma.product.findUniqueOrThrow({
    where: { tenant_id_sku: { tenant_id: tenant.id, sku } }
  });
  console.log("after update-only is_active=", after2.is_active);
  if (!after2.is_active) throw new Error("update-only import did not reactivate");

  console.log("OK reactivate on both import paths");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
