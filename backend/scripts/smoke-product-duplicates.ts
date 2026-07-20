/**
 * Dublikat oldini olish smoke: bir xil nom/SKU qayta create qilinmasligi.
 */
import ExcelJS from "exceljs";
import { prisma } from "../src/config/database";
import { createProduct } from "../src/modules/products/products.crud";
import { importProductsFromCatalogTemplateXlsx } from "../src/modules/products/products.import.catalog";

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });
  const cat = await prisma.productCategory.findFirstOrThrow({
    where: { tenant_id: tenant.id }
  });

  await createProduct(tenant.id, {
    sku: "DUP-1",
    name: "Unique Product A",
    unit: "dona",
    category_id: cat.id
  });

  let nameBlocked = false;
  try {
    await createProduct(tenant.id, {
      sku: "DUP-2",
      name: "unique product a",
      unit: "dona",
      category_id: cat.id
    });
  } catch (e) {
    nameBlocked = e instanceof Error && e.message === "NAME_EXISTS";
  }
  if (!nameBlocked) throw new Error("NAME_EXISTS kutilgan edi");

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Import");
  ws.addRow(["Название *", "Код", "Категория *", "Единица измерения (название) *"]);
  ws.addRow(["Unique Product A", "DUP-1", cat.name, "dona"]);
  ws.addRow(["Unique Product A", "DUP-3", cat.name, "dona"]);
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const result = await importProductsFromCatalogTemplateXlsx(tenant.id, buf, 1);
  console.log(result);
  if (result.errors.length === 0) throw new Error("Fayl ichidagi dublikat xatosi kutilgan edi");
  const count = await prisma.product.count({
    where: { tenant_id: tenant.id, name: { equals: "Unique Product A", mode: "insensitive" } }
  });
  if (count !== 1) throw new Error(`Nom dublikati: count=${count}`);
  console.log("✅ Duplicate prevention OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
