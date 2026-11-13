import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import {
  releaseReservedQtyClamped,
  reserveOutboundNeedMap
} from "../src/modules/orders/domain/order.stock-lock";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("orders stock lock (parallel reserve)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("two concurrent reserves of 10 from stock 10 → one wins", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const warehouse =
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId, type: "main" } })) ??
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId } }));
    expect(warehouse).toBeTruthy();

    const product = await prisma.product.findFirst({
      where: { tenant_id: tenantId, sku: "SKU-001" }
    });
    expect(product).toBeTruthy();

    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouse!.id,
          product_id: product!.id
        }
      },
      create: {
        tenant_id: tenantId,
        warehouse_id: warehouse!.id,
        product_id: product!.id,
        qty: new Prisma.Decimal(10),
        reserved_qty: new Prisma.Decimal(0)
      },
      update: {
        qty: new Prisma.Decimal(10),
        reserved_qty: new Prisma.Decimal(0)
      }
    });

    const need = new Map<number, Prisma.Decimal>([[product!.id, new Prisma.Decimal(10)]]);
    const run = () =>
      prisma.$transaction((tx) =>
        reserveOutboundNeedMap(tx, {
          tenantId,
          warehouseId: warehouse!.id,
          needByProduct: need
        })
      );

    const settled = await Promise.allSettled([run(), run()]);
    const ok = settled.filter((r) => r.status === "fulfilled");
    const fail = settled.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect((fail[0] as PromiseRejectedResult).reason?.message).toBe("INSUFFICIENT_STOCK");

    const row = await prisma.stock.findUnique({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouse!.id,
          product_id: product!.id
        }
      }
    });
    expect(row?.reserved_qty.toString()).toBe("10");
  }, 30_000);

  it("releaseReservedQtyClamped — reserved 0 dan pastga tushmaydi", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const warehouse =
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId, type: "main" } })) ??
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId } }));
    expect(warehouse).toBeTruthy();

    const product = await prisma.product.findFirst({
      where: { tenant_id: tenantId, sku: "SKU-001" }
    });
    expect(product).toBeTruthy();

    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouse!.id,
          product_id: product!.id
        }
      },
      create: {
        tenant_id: tenantId,
        warehouse_id: warehouse!.id,
        product_id: product!.id,
        qty: new Prisma.Decimal(10),
        reserved_qty: new Prisma.Decimal(2)
      },
      update: {
        qty: new Prisma.Decimal(10),
        reserved_qty: new Prisma.Decimal(2)
      }
    });

    await prisma.$transaction((tx) =>
      releaseReservedQtyClamped(tx, {
        tenantId,
        warehouseId: warehouse!.id,
        productId: product!.id,
        qty: new Prisma.Decimal(5)
      })
    );

    const row = await prisma.stock.findUnique({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouse!.id,
          product_id: product!.id
        }
      }
    });
    expect(row?.reserved_qty.toString()).toBe("0");
  }, 30_000);
});
