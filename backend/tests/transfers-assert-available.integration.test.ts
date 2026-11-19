/**
 * ADR-007 M1.3: transfers → StockReservation.assertAvailable.
 * Call site’da qayta available formula assert yo‘q.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { assertAvailable } from "../src/modules/stock/stock-reservation";
import { assertSourceStockForLines } from "../src/modules/stock/warehouse-transfers.shared";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("transfers use assertAvailable", () => {
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

  it("assertSourceStockForLines ≡ assertAvailable (yetarli / yetarli emas)", async () => {
    const { tenantId, warehouseId, productId } = await fixture();

    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          product_id: productId
        }
      },
      create: {
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        product_id: productId,
        qty: new Prisma.Decimal(10),
        reserved_qty: new Prisma.Decimal(4)
      },
      update: {
        qty: new Prisma.Decimal(10),
        reserved_qty: new Prisma.Decimal(4)
      }
    });

    // available = 6
    await expect(
      assertSourceStockForLines(tenantId, warehouseId, [{ product_id: productId, qty: 6 }])
    ).resolves.toBeUndefined();

    await expect(
      assertAvailable(prisma, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(6)]])
      })
    ).resolves.toBeUndefined();

    await expect(
      assertSourceStockForLines(tenantId, warehouseId, [{ product_id: productId, qty: 7 }])
    ).rejects.toThrow(/INSUFFICIENT_STOCK/);

    await expect(
      assertAvailable(prisma, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(7)]])
      })
    ).rejects.toThrow("INSUFFICIENT_STOCK");

    // reserved band: qty 10 lekin available 6 — 10 ta so‘rov rad
    await expect(
      assertSourceStockForLines(tenantId, warehouseId, [{ product_id: productId, qty: 10 }])
    ).rejects.toThrow(/INSUFFICIENT_STOCK:product=/);

    const row = await prisma.stock.findUnique({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          product_id: productId
        }
      }
    });
    expect(row?.reserved_qty.toString()).toBe("4");
    expect(row?.qty.toString()).toBe("10");
  });
});
