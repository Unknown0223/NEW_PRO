/**
 * ADR-007 M1.1 / T2: StockReservation seam — reserve / release / consume / assertAvailable + race.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import {
  assertAvailable,
  consume,
  release,
  reserve
} from "../src/modules/stock/stock-reservation";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

async function seedStock(opts: {
  tenantId: number;
  warehouseId: number;
  productId: number;
  qty: string;
  reserved: string;
}) {
  await prisma.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: opts.tenantId,
        warehouse_id: opts.warehouseId,
        product_id: opts.productId
      }
    },
    create: {
      tenant_id: opts.tenantId,
      warehouse_id: opts.warehouseId,
      product_id: opts.productId,
      qty: new Prisma.Decimal(opts.qty),
      reserved_qty: new Prisma.Decimal(opts.reserved)
    },
    update: {
      qty: new Prisma.Decimal(opts.qty),
      reserved_qty: new Prisma.Decimal(opts.reserved)
    }
  });
}

async function readStock(tenantId: number, warehouseId: number, productId: number) {
  return prisma.stock.findUnique({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        product_id: productId
      }
    }
  });
}

describe.skipIf(!dbReady)("StockReservation", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function fixture() {
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
    return { tenantId, warehouseId: warehouse!.id, productId: product!.id };
  }

  it("reserve — yetarli: reserved_qty oshadi", async () => {
    const { tenantId, warehouseId, productId } = await fixture();
    await seedStock({ tenantId, warehouseId, productId, qty: "20", reserved: "0" });

    await prisma.$transaction((tx) =>
      reserve(tx, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(7)]])
      })
    );

    const row = await readStock(tenantId, warehouseId, productId);
    expect(row?.qty.toString()).toBe("20");
    expect(row?.reserved_qty.toString()).toBe("7");
  });

  it("reserve — yetarli emas: INSUFFICIENT_STOCK", async () => {
    const { tenantId, warehouseId, productId } = await fixture();
    await seedStock({ tenantId, warehouseId, productId, qty: "5", reserved: "2" });

    await expect(
      prisma.$transaction((tx) =>
        reserve(tx, {
          tenantId,
          warehouseId,
          needByProduct: new Map([[productId, new Prisma.Decimal(4)]])
        })
      )
    ).rejects.toThrow("INSUFFICIENT_STOCK");

    const row = await readStock(tenantId, warehouseId, productId);
    expect(row?.reserved_qty.toString()).toBe("2");
  });

  it("assertAvailable — yetarli / yetarli emas (yozuvsiz)", async () => {
    const { tenantId, warehouseId, productId } = await fixture();
    await seedStock({ tenantId, warehouseId, productId, qty: "10", reserved: "3" });

    await expect(
      assertAvailable(prisma, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(7)]])
      })
    ).resolves.toBeUndefined();

    await expect(
      assertAvailable(prisma, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(8)]])
      })
    ).rejects.toThrow("INSUFFICIENT_STOCK");

    const row = await readStock(tenantId, warehouseId, productId);
    expect(row?.reserved_qty.toString()).toBe("3");
    expect(row?.qty.toString()).toBe("10");
  });

  it("release — reserved 0 dan pastga tushmaydi (clamp)", async () => {
    const { tenantId, warehouseId, productId } = await fixture();
    await seedStock({ tenantId, warehouseId, productId, qty: "10", reserved: "2" });

    await prisma.$transaction((tx) =>
      release(tx, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(5)]])
      })
    );

    const row = await readStock(tenantId, warehouseId, productId);
    expect(row?.reserved_qty.toString()).toBe("0");
    expect(row?.qty.toString()).toBe("10");
  });

  it("consume — qty va reserved_qty birga kamayadi", async () => {
    const { tenantId, warehouseId, productId } = await fixture();
    await seedStock({ tenantId, warehouseId, productId, qty: "15", reserved: "6" });

    await prisma.$transaction((tx) =>
      consume(tx, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(4)]])
      })
    );

    const row = await readStock(tenantId, warehouseId, productId);
    expect(row?.qty.toString()).toBe("11");
    expect(row?.reserved_qty.toString()).toBe("2");
  });

  it("consume — qty yetmasa manfiyga tushirmaydi (reserved > qty)", async () => {
    const { tenantId, warehouseId, productId } = await fixture();
    await seedStock({ tenantId, warehouseId, productId, qty: "3", reserved: "5" });

    await expect(
      prisma.$transaction((tx) =>
        consume(tx, {
          tenantId,
          warehouseId,
          needByProduct: new Map([[productId, new Prisma.Decimal(5)]])
        })
      )
    ).rejects.toThrow("INSUFFICIENT_STOCK");

    const row = await readStock(tenantId, warehouseId, productId);
    expect(row?.qty.toString()).toBe("3");
    expect(row?.reserved_qty.toString()).toBe("5");
  });

  it("parallel race: ikkita reserve(10) stock 10 dan — biri yutadi", async () => {
    const { tenantId, warehouseId, productId } = await fixture();
    await seedStock({ tenantId, warehouseId, productId, qty: "10", reserved: "0" });

    const need = new Map<number, Prisma.Decimal>([[productId, new Prisma.Decimal(10)]]);
    const run = () =>
      prisma.$transaction((tx) =>
        reserve(tx, { tenantId, warehouseId, needByProduct: need })
      );

    const settled = await Promise.allSettled([run(), run()]);
    const ok = settled.filter((r) => r.status === "fulfilled");
    const fail = settled.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
    expect((fail[0] as PromiseRejectedResult).reason?.message).toBe("INSUFFICIENT_STOCK");

    const row = await readStock(tenantId, warehouseId, productId);
    expect(row?.reserved_qty.toString()).toBe("10");
  }, 30_000);
});
