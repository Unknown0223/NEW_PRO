/**
 * ADR-007 M1.2: orders create / cancelled→new → StockReservation.reserve.
 * Call site’da qayta reserved_qty SQL assert yo‘q — natija reserved orqali.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { createOrder } from "../src/modules/orders/domain/order.create";
import { updateOrderStatus } from "../src/modules/orders/domain/order.lifecycle";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

async function readReserved(tenantId: number, warehouseId: number, productId: number) {
  const row = await prisma.stock.findUnique({
    where: {
      tenant_id_warehouse_id_product_id: {
        tenant_id: tenantId,
        warehouse_id: warehouseId,
        product_id: productId
      }
    }
  });
  return row?.reserved_qty ?? new Prisma.Decimal(0);
}

describe.skipIf(!dbReady)("orders use StockReservation", () => {
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

    const client = await prisma.client.findFirst({
      where: { tenant_id: tenantId, merged_into_client_id: null, is_active: true }
    });
    expect(client).toBeTruthy();

    const agent = await prisma.user.findFirst({
      where: { tenant_id: tenantId, role: "agent", is_active: true }
    });
    expect(agent).toBeTruthy();

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
        qty: new Prisma.Decimal(1000),
        reserved_qty: new Prisma.Decimal(0)
      },
      update: {
        qty: new Prisma.Decimal(1000),
        reserved_qty: new Prisma.Decimal(0)
      }
    });

    return {
      tenantId,
      warehouseId: warehouse!.id,
      productId: product!.id,
      clientId: client!.id,
      agentId: agent!.id
    };
  }

  it("createOrder outbound → reserved_qty oshadi (adapter → reserve)", async () => {
    const { tenantId, warehouseId, productId, clientId, agentId } = await fixture();
    const before = await readReserved(tenantId, warehouseId, productId);

    const order = await createOrder(
      tenantId,
      {
        client_id: clientId,
        warehouse_id: warehouseId,
        agent_id: agentId,
        apply_bonus: false,
        apply_discount: false,
        items: [{ product_id: productId, qty: 3 }]
      },
      { role: "admin" }
    );

    expect(order.status).toBe("new");
    const after = await readReserved(tenantId, warehouseId, productId);
    expect(after.sub(before).toString()).toBe("3");
  });

  it("cancelled → new re-reserve: reserved qayta oshadi; yetarli bo‘lmasa INSUFFICIENT_STOCK", async () => {
    const { tenantId, warehouseId, productId, clientId, agentId } = await fixture();

    const order = await createOrder(
      tenantId,
      {
        client_id: clientId,
        warehouse_id: warehouseId,
        agent_id: agentId,
        apply_bonus: false,
        apply_discount: false,
        items: [{ product_id: productId, qty: 5 }]
      },
      { role: "admin" }
    );

    await updateOrderStatus(tenantId, order.id, "cancelled", null, "admin");
    expect((await readReserved(tenantId, warehouseId, productId)).toString()).toBe("0");

    const reopened = await updateOrderStatus(tenantId, order.id, "new", null, "admin");
    expect(reopened.status).toBe("new");
    expect((await readReserved(tenantId, warehouseId, productId)).toString()).toBe("5");

    await updateOrderStatus(tenantId, order.id, "cancelled", null, "admin");
    await prisma.stock.update({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenantId,
          warehouse_id: warehouseId,
          product_id: productId
        }
      },
      data: { qty: new Prisma.Decimal(0), reserved_qty: new Prisma.Decimal(0) }
    });

    await expect(updateOrderStatus(tenantId, order.id, "new", null, "admin")).rejects.toThrow(
      "INSUFFICIENT_STOCK"
    );
  });
});
