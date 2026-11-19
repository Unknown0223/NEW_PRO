/**
 * ADR-007 M1.4: bonus-cap / adjustment → StockReservation.assertAvailable.
 * Call site’da qayta available formula assert yo‘q.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { capBonusCreatesToStock } from "../src/modules/orders/order-bonus-stock-cap";
import { applyStockAdjustmentInTx } from "../src/modules/stock/stock.movements";
import { assertAvailable } from "../src/modules/stock/stock-reservation";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("bonus-cap / adjustment use assertAvailable", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("call sites wire assertAvailable / loadAvailableByProduct (no hand Available)", () => {
    const bonusCap = readFileSync(
      join(__dirname, "../src/modules/orders/order-bonus-stock-cap.ts"),
      "utf8"
    );
    const movements = readFileSync(
      join(__dirname, "../src/modules/stock/stock.movements.ts"),
      "utf8"
    );
    const matchGifts = readFileSync(
      join(__dirname, "../src/modules/orders/order-bonus-context.match-gifts.ts"),
      "utf8"
    );

    expect(bonusCap).toMatch(/from ["']\.\.\/stock\/stock-reservation["']/);
    expect(bonusCap).toMatch(/assertAvailable\s*\(/);
    expect(bonusCap).toMatch(/loadAvailableByProduct\s*\(/);
    expect(bonusCap).not.toMatch(/reserved_qty/);

    expect(movements).toMatch(/from ["']\.\/stock-reservation["']/);
    expect(movements).toMatch(/assertAvailable\s*\(/);
    expect(movements).toMatch(/BELOW_RESERVED/);

    expect(matchGifts).toMatch(/loadAvailableByProduct/);
    expect(matchGifts).not.toMatch(/Math\.max\(0,\s*Number\(s\.reserved_qty\)\)/);
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

  it("capBonusCreatesToStock — paid yetarli emas → INSUFFICIENT_STOCK (assertAvailable)", async () => {
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
        qty: new Prisma.Decimal(5),
        reserved_qty: new Prisma.Decimal(2)
      },
      update: { qty: new Prisma.Decimal(5), reserved_qty: new Prisma.Decimal(2) }
    });

    // available = 3
    await expect(
      prisma.$transaction((tx) =>
        capBonusCreatesToStock(
          tx,
          tenantId,
          warehouseId,
          [
            {
              product_id: productId,
              qty: new Prisma.Decimal(4),
              price: new Prisma.Decimal(1),
              total: new Prisma.Decimal(4)
            }
          ],
          [
            {
              product_id: productId,
              qty: new Prisma.Decimal(1),
              price: new Prisma.Decimal(0),
              total: new Prisma.Decimal(0),
              is_bonus: true as const
            }
          ]
        )
      )
    ).rejects.toThrow("INSUFFICIENT_STOCK");

    await expect(
      assertAvailable(prisma, {
        tenantId,
        warehouseId,
        needByProduct: new Map([[productId, new Prisma.Decimal(4)]])
      })
    ).rejects.toThrow("INSUFFICIENT_STOCK");
  });

  it("capBonusCreatesToStock — bonus soft-cap Available qoldig‘iga", async () => {
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
        reserved_qty: new Prisma.Decimal(0)
      },
      update: { qty: new Prisma.Decimal(10), reserved_qty: new Prisma.Decimal(0) }
    });

    const result = await prisma.$transaction((tx) =>
      capBonusCreatesToStock(
        tx,
        tenantId,
        warehouseId,
        [
          {
            product_id: productId,
            qty: new Prisma.Decimal(8),
            price: new Prisma.Decimal(1),
            total: new Prisma.Decimal(8)
          }
        ],
        [
          {
            product_id: productId,
            qty: new Prisma.Decimal(5),
            price: new Prisma.Decimal(0),
            total: new Prisma.Decimal(0),
            is_bonus: true as const
          }
        ]
      )
    );

    // room = 10 - 8 = 2
    expect(result.bonusCreates).toHaveLength(1);
    expect(result.bonusCreates[0]!.qty.toString()).toBe("2");
    expect(result.bonusAlert).toBe("stock_shortage");
  });

  it("applyStockAdjustmentInTx — reserved pastiga tushirish BELOW_RESERVED (assertAvailable)", async () => {
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
        reserved_qty: new Prisma.Decimal(7)
      },
      update: { qty: new Prisma.Decimal(10), reserved_qty: new Prisma.Decimal(7) }
    });

    // available = 3; -4 → BELOW_RESERVED
    await expect(
      prisma.$transaction((tx) =>
        applyStockAdjustmentInTx(tx, tenantId, {
          warehouse_id: warehouseId,
          product_id: productId,
          delta: -4
        })
      )
    ).rejects.toThrow("BELOW_RESERVED");

    const row = await prisma.stock.findUnique({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          product_id: productId
        }
      }
    });
    expect(row?.qty.toString()).toBe("10");
    expect(row?.reserved_qty.toString()).toBe("7");
  });
});
