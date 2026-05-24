import { Prisma } from "@prisma/client";
import { ensureWarehouse, mergeDefaultReasonReferences, prisma } from "./helpers";

export async function seedDemoTenant() {
  const demo = await prisma.tenant.findUniqueOrThrow({ where: { slug: "demo" } });
  const test1 = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });

  const demoWh = await ensureWarehouse(demo.id, "Demo ombor", "main");
  if (!(await prisma.product.findFirst({ where: { tenant_id: demo.id, sku: "DEMO-001" } }))) {
    await prisma.product.create({
      data: {
        tenant_id: demo.id,
        sku: "DEMO-001",
        name: "Demo mahsulot A",
        unit: "dona",
        is_active: true
      }
    });
  }
  const demoProd = await prisma.product.findFirst({
    where: { tenant_id: demo.id, sku: "DEMO-001" }
  });
  if (demoProd) {
    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: demo.id,
          warehouse_id: demoWh.id,
          product_id: demoProd.id
        }
      },
      update: { qty: 50 },
      create: {
        tenant_id: demo.id,
        warehouse_id: demoWh.id,
        product_id: demoProd.id,
        qty: 50,
        reserved_qty: 0
      }
    });
    await prisma.productPrice.upsert({
      where: {
        tenant_id_product_id_price_type: {
          tenant_id: demo.id,
          product_id: demoProd.id,
          price_type: "retail"
        }
      },
      create: {
        tenant_id: demo.id,
        product_id: demoProd.id,
        price_type: "retail",
        price: new Prisma.Decimal(12000)
      },
      update: { price: new Prisma.Decimal(12000) }
    });
  }

  await mergeDefaultReasonReferences(test1.id);
  await mergeDefaultReasonReferences(demo.id);
}
