import request from "supertest";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { describeOrdersIntegrationSuite, mainWarehouseId } from "./orders.integration.harness";

const RULE_PREFIX = "[vitest-oa]";

describeOrdersIntegrationSuite("order automation", (ctx) => {
  let warehouseId = 0;
  let clientId = 0;
  let productId = 0;

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).not.toBeNull();
    await prisma.orderRestrictionRule.deleteMany({
      where: { tenant_id: tenant!.id, name: { startsWith: RULE_PREFIX } }
    });
    await prisma.orderAutoConfirmRule.deleteMany({
      where: { tenant_id: tenant!.id, name: { startsWith: RULE_PREFIX } }
    });
  });

  afterAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    if (!tenant) return;
    await prisma.orderRestrictionRule.deleteMany({
      where: { tenant_id: tenant.id, name: { startsWith: RULE_PREFIX } }
    });
    await prisma.orderAutoConfirmRule.deleteMany({
      where: { tenant_id: tenant.id, name: { startsWith: RULE_PREFIX } }
    });
  });

  it("restriction rule blocks order create with OrderRestricted", async () => {
    const login = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    const token = login.body.accessToken as string;
    warehouseId = await mainWarehouseId(ctx.app, token);

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${token}`);
    clientId = clientsRes.body.data[0].id as number;

    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${token}`);
    productId = productsRes.body.data[0].id as number;

    const ruleRes = await request(ctx.app.server)
      .post("/api/test1/order-restriction-rules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `${RULE_PREFIX} block`,
        is_active: true,
        scope_warehouse_ids: [warehouseId],
        consignment_mode: "all",
        currency_code: "UZS"
      });
    expect(ruleRes.status).toBe(201);
    const ruleId = ruleRes.body.data.id as number;

    const blocked = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe("OrderRestricted");

    await request(ctx.app.server)
      .patch(`/api/test1/order-restriction-rules/${ruleId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ is_active: false });

    const ok = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(ok.status).toBe(201);
    await prisma.order.delete({ where: { id: ok.body.id as number } });
  });

  it("lists rules with warehouse_id filter", async () => {
    const login = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    const token = login.body.accessToken as string;

    const create = await request(ctx.app.server)
      .post("/api/test1/order-restriction-rules")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: `${RULE_PREFIX} list`,
        is_active: true,
        scope_warehouse_ids: [warehouseId],
        consignment_mode: "all",
        currency_code: "UZS"
      });
    expect(create.status).toBe(201);
    const id = create.body.data.id as number;

    const list = await request(ctx.app.server)
      .get(`/api/test1/order-restriction-rules?warehouse_id=${warehouseId}&is_active=true`)
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect((list.body.data as { id: number }[]).some((r) => r.id === id)).toBe(true);

    await request(ctx.app.server)
      .delete(`/api/test1/order-restriction-rules/${id}`)
      .set("Authorization", `Bearer ${token}`);
  });
});
