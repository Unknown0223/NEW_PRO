import request from "supertest";
import { expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { describeOrdersIntegrationSuite, mainWarehouseId } from "./orders.integration.harness";
import { loginForIntegrationTest } from "./test-auth.helpers";

async function adminToken(app: import("fastify").FastifyInstance): Promise<string> {
  const loginResponse = await loginForIntegrationTest(app, {
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  expect(loginResponse.status).toBe(200);
  return loginResponse.body.accessToken as string;
}

async function deliverOrder(app: import("fastify").FastifyInstance, token: string, orderId: number) {
  for (const status of ["confirmed", "picking", "delivering", "delivered"] as const) {
    const patch = await request(app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status });
    expect(patch.status).toBe(200);
  }
}

describeOrdersIntegrationSuite("order-scoped returns", (ctx) => {
  it("po zakaz: server preview pullik qaytaradi; ikkinchi to‘liq qaytarish bloklanadi", async () => {
    const token = await adminToken(ctx.app);
    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${token}`);
    const clientId = clientsRes.body.data[0].id as number;

    const p1 = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${token}`);
    const p2 = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-002")
      .set("Authorization", `Bearer ${token}`);
    const product1 = p1.body.data[0].id as number;
    const product2 = p2.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(ctx.app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [
          { product_id: product1, qty: 10 },
          { product_id: product2, qty: 10 }
        ]
      });
    expect(create.status).toBe(201);
    const orderId = create.body.id as number;
    await deliverOrder(ctx.app, token, orderId);

    const wrongSplit = await request(ctx.app.server)
      .post("/api/test1/returns/period")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: clientId,
        warehouse_id: warehouseId,
        order_id: orderId,
        price_type: "retail",
        lines: [
          { product_id: product1, paid_qty: 0, bonus_qty: 10, bonus_cash: 0 },
          { product_id: product2, paid_qty: 0, bonus_qty: 10, bonus_cash: 0 }
        ]
      });
    expect(wrongSplit.status).toBe(201);
    expect(Number(wrongSplit.body.refund_amount)).toBeGreaterThan(0);

    const ret = await prisma.salesReturn.findFirst({
      where: { number: wrongSplit.body.number as string },
      include: { lines: true }
    });
    expect(ret).toBeTruthy();
    const paidSum = ret!.lines.reduce((a, l) => a + Number(l.paid_qty ?? 0), 0);
    expect(paidSum).toBeGreaterThan(0);

    const mirror = await prisma.order.findFirst({ where: { number: wrongSplit.body.number as string } });
    expect(mirror).toBeTruthy();
    expect(Number(mirror!.total_sum)).toBeGreaterThan(0);

    const second = await request(ctx.app.server)
      .post("/api/test1/returns/period")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: clientId,
        warehouse_id: warehouseId,
        order_id: orderId,
        price_type: "retail",
        lines: [
          { product_id: product1, paid_qty: 0, bonus_qty: 10, bonus_cash: 0 },
          { product_id: product2, paid_qty: 0, bonus_qty: 10, bonus_cash: 0 }
        ]
      });
    expect(second.status).toBe(400);
    expect(["OrderFullyReturned", "QtyExceedsOrdered", "NothingToReturn", "EmptyLines"]).toContain(
      second.body.error
    );
  });
});
