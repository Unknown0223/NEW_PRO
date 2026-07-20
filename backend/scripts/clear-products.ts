/**
 * Tenant mahsulotlarini (va bog‘liq qatorlarni) tozalash.
 * Ishga tushirish:
 *   CONFIRM_CLEAR_PRODUCTS=YES npx tsx scripts/clear-products.ts
 */
import { prisma } from "../src/config/database";

const TENANT = process.env.IMPORT_TENANT_SLUG ?? "test1";

async function main() {
  if ((process.env.CONFIRM_CLEAR_PRODUCTS ?? "").trim().toUpperCase() !== "YES") {
    console.error("To‘xtatildi. CONFIRM_CLEAR_PRODUCTS=YES qo‘ying.");
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT } });
  if (!tenant) throw new Error(`Tenant ${TENANT} topilmadi`);

  const products = await prisma.product.findMany({
    where: { tenant_id: tenant.id },
    select: { id: true }
  });
  const ids = products.map((p) => p.id);
  console.log(`Tenant ${TENANT}: ${ids.length} mahsulot o‘chiriladi…`);

  if (!ids.length) {
    console.log("Allaqachon bo‘sh.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { product_id: { in: ids } } });
    await tx.goodsReceiptLine.deleteMany({ where: { product_id: { in: ids } } });
    await tx.salesReturnLine.deleteMany({ where: { product_id: { in: ids } } });
    await tx.stockTakeLine.deleteMany({ where: { product_id: { in: ids } } });
    await tx.warehouseCorrectionLine.deleteMany({ where: { product_id: { in: ids } } });
    await tx.stock.deleteMany({ where: { product_id: { in: ids } } });
    await tx.productPrice.deleteMany({ where: { product_id: { in: ids } } });
    await tx.productPriceSchedule.deleteMany({ where: { product_id: { in: ids } } });
    await tx.kpiGroupProduct.deleteMany({ where: { product_id: { in: ids } } });
    await tx.interchangeableGroupProduct.deleteMany({ where: { product_id: { in: ids } } });
    await tx.productPackaging.deleteMany({ where: { product_id: { in: ids } } });
    await tx.productSegmentLink.deleteMany({ where: { product_id: { in: ids } } });
    await tx.productTradeDirectionLink.deleteMany({ where: { product_id: { in: ids } } });
    const deleted = await tx.product.deleteMany({ where: { tenant_id: tenant.id } });
    console.log(`O‘chirildi: ${deleted.count} mahsulot`);
  });

  const left = await prisma.product.count({ where: { tenant_id: tenant.id } });
  console.log(`Qoldi: ${left}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
