import { prisma } from "../src/config/database";

const TENANT = process.env.IMPORT_TENANT_SLUG ?? "test1";

async function main() {
  const t = await prisma.tenant.findUnique({ where: { slug: TENANT } });
  if (!t) throw new Error(`Tenant ${TENANT} topilmadi`);
  const ids = (
    await prisma.product.findMany({ where: { tenant_id: t.id }, select: { id: true } })
  ).map((p) => p.id);
  console.log(
    JSON.stringify(
      {
        tenant: TENANT,
        products: ids.length,
        orderItems: ids.length
          ? await prisma.orderItem.count({ where: { product_id: { in: ids } } })
          : 0,
        stock: ids.length ? await prisma.stock.count({ where: { product_id: { in: ids } } }) : 0,
        goodsReceiptLines: ids.length
          ? await prisma.goodsReceiptLine.count({ where: { product_id: { in: ids } } })
          : 0,
        salesReturnLines: ids.length
          ? await prisma.salesReturnLine.count({ where: { product_id: { in: ids } } })
          : 0,
        stockTakeLines: ids.length
          ? await prisma.stockTakeLine.count({ where: { product_id: { in: ids } } })
          : 0,
        warehouseCorrectionLines: ids.length
          ? await prisma.warehouseCorrectionLine.count({ where: { product_id: { in: ids } } })
          : 0,
        prices: ids.length
          ? await prisma.productPrice.count({ where: { product_id: { in: ids } } })
          : 0
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
