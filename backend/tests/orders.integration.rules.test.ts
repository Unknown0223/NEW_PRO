import request from "supertest";
import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { describeOrdersIntegrationSuite, mainWarehouseId } from "./orders.integration.harness";
import { loginForIntegrationTest } from "./test-auth.helpers";

describeOrdersIntegrationSuite("bonus rules and credit", (ctx) => {
  it("once_per_client: discount rule applies once per client, second order full price", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).not.toBeNull();
    const tenantId = tenant!.id;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          bonus_stack: { mode: "all", max_units: null, forbid_apply_all_eligible: false }
        } as object
      }
    });

    const freshClient = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: "once-per-client (integration)",
        phone: "+998900000199",
        phone_normalized: "998900000199"
      }
    });

    const sku2 = await prisma.product.findFirst({
      where: { tenant_id: tenantId, sku: "SKU-002" }
    });
    expect(sku2).toBeTruthy();

    await prisma.bonusRule.updateMany({
      where: { tenant_id: tenantId, name: "[seed] Chegirma 10%" },
      data: { once_per_client: true, product_ids: [sku2!.id] }
    });
    await prisma.bonusRule.updateMany({
      where: { tenant_id: tenantId, name: "[seed] Min summa 500 000" },
      data: { is_active: false }
    });

    try {
      const loginResponse = await loginForIntegrationTest(ctx.app, {
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(loginResponse.status).toBe(200);
      const token = loginResponse.body.accessToken as string;

      const productsRes = await request(ctx.app.server)
        .get("/api/test1/products?page=1&limit=5&search=SKU-002")
        .set("Authorization", `Bearer ${token}`);
      const productId = productsRes.body.data[0].id as number;
      const warehouseId = await mainWarehouseId(ctx.app, token);

      const first = await request(ctx.app.server)
        .post("/api/test1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          agent_id: ctx.seedAgentUserId,
          client_id: freshClient.id,
          warehouse_id: warehouseId,
          items: [{ product_id: productId, qty: 10 }]
        });
      expect(first.status).toBe(201);
      expect(first.body.total_sum).toBe("540000");

      const second = await request(ctx.app.server)
        .post("/api/test1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          agent_id: ctx.seedAgentUserId,
          client_id: freshClient.id,
          warehouse_id: warehouseId,
          items: [{ product_id: productId, qty: 10 }]
        });
      expect(second.status).toBe(201);
      expect(second.body.total_sum).toBe("600000");
    } finally {
      await prisma.order.deleteMany({ where: { client_id: freshClient.id } });
      await prisma.client.delete({ where: { id: freshClient.id } });
      await prisma.bonusRule.updateMany({
        where: { tenant_id: tenantId, name: "[seed] Chegirma 10%" },
        data: { once_per_client: false, product_ids: [sku2!.id] }
      });
      await prisma.bonusRule.updateMany({
        where: { tenant_id: tenantId, name: "[seed] Min summa 500 000" },
        data: { is_active: true, discount_pct: null }
      });
    }
  });

  it("POST order rejects when open orders total + new order exceeds client credit_limit", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).not.toBeNull();

    const freshClient = await prisma.client.create({
      data: {
        tenant_id: tenant!.id,
        name: "credit-test (integration)",
        phone: "+998900000298",
        phone_normalized: "998900000298",
        credit_limit: new Prisma.Decimal("50000")
      }
    });

    const loginResponse = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    try {
      const productsRes = await request(ctx.app.server)
        .get("/api/test1/products?page=1&limit=5&search=SKU-001")
        .set("Authorization", `Bearer ${token}`);
      const productId = productsRes.body.data[0].id as number;
      const warehouseId = await mainWarehouseId(ctx.app, token);

      const first = await request(ctx.app.server)
        .post("/api/test1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          agent_id: ctx.seedAgentUserId,
          client_id: freshClient.id,
          warehouse_id: warehouseId,
          items: [{ product_id: productId, qty: 2 }]
        });
      expect(first.status).toBe(201);
      expect(first.body.total_sum).toBe("50000");

      const second = await request(ctx.app.server)
        .post("/api/test1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          agent_id: ctx.seedAgentUserId,
          client_id: freshClient.id,
          warehouse_id: warehouseId,
          items: [{ product_id: productId, qty: 1 }]
        });
      expect(second.status).toBe(400);
      expect(second.body.error).toBe("CreditLimitExceeded");
      expect(second.body.credit_limit).toBe("50000");
      expect(second.body.outstanding).toBe("50000");
      expect(second.body.order_total).toBe("25000");
    } finally {
      await prisma.order.deleteMany({ where: { client_id: freshClient.id } });
      await prisma.client.delete({ where: { id: freshClient.id } });
    }
  });
});
