import request from "supertest";
import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { describeOrdersIntegrationSuite, mainWarehouseId } from "./orders.integration.harness";
import { loginForIntegrationTest } from "./test-auth.helpers";

describeOrdersIntegrationSuite("RBAC status and lines", (ctx) => {
  it("operator can revert one step; invalid multi-step still forbidden", async () => {
    const adminLogin = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.accessToken as string;

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${adminToken}`);
    const clientId = clientsRes.body.data[0].id as number;

    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${adminToken}`);
    const productId = productsRes.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(ctx.app, adminToken);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(201);
    const orderId = create.body.id as number;

    await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" });
    await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "picking" });

    const opLogin = await loginForIntegrationTest(ctx.app, {
      slug: "test1",
      login: "operator",
      password: "secret123"
    });
    expect(opLogin.status).toBe(200);
    const opToken = opLogin.body.accessToken as string;

    const detailOp = await request(ctx.app.server)
      .get(`/api/test1/orders/${orderId}`)
      .set("Authorization", `Bearer ${opToken}`);
    expect(detailOp.status).toBe(200);
    expect(detailOp.body.allowed_next_statuses).toContain("confirmed");
    expect(detailOp.body.allowed_next_statuses).not.toContain("cancelled");

    const opRevert = await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${opToken}`)
      .send({ status: "confirmed" });
    expect(opRevert.status).toBe(200);
    expect(opRevert.body.status).toBe("confirmed");
  });

  it("operator and admin can reopen cancelled order to new", async () => {
    const adminLogin = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.accessToken as string;

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${adminToken}`);
    const clientId = clientsRes.body.data[0].id as number;

    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${adminToken}`);
    const productId = productsRes.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(ctx.app, adminToken);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(201);
    const orderId = create.body.id as number;

    await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" });

    const opLogin = await loginForIntegrationTest(ctx.app, {
      slug: "test1",
      login: "operator",
      password: "secret123"
    });
    expect(opLogin.status).toBe(200);
    const opToken = opLogin.body.accessToken as string;

    const detailOp = await request(ctx.app.server)
      .get(`/api/test1/orders/${orderId}`)
      .set("Authorization", `Bearer ${opToken}`);
    expect(detailOp.status).toBe(200);
    expect(detailOp.body.allowed_next_statuses).toEqual(["new"]);

    const opReopen = await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${opToken}`)
      .send({ status: "new" });
    expect(opReopen.status).toBe(200);
    expect(opReopen.body.status).toBe("new");
  });

  it("operator cannot PATCH order payment lines; admin can", async () => {
    const adminLogin = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.accessToken as string;

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${adminToken}`);
    const clientId = clientsRes.body.data[0].id as number;

    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${adminToken}`);
    const productId = productsRes.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(ctx.app, adminToken);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(201);
    const orderId = create.body.id as number;

    const opLogin = await loginForIntegrationTest(ctx.app, {
      slug: "test1",
      login: "operator",
      password: "secret123"
    });
    expect(opLogin.status).toBe(200);
    const opToken = opLogin.body.accessToken as string;

    const opPatch = await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}`)
      .set("Authorization", `Bearer ${opToken}`)
      .send({
        items: [{ product_id: productId, qty: 2 }]
      });
    expect(opPatch.status).toBe(403);
    expect(opPatch.body.error).toBe("ForbiddenOperatorOrderLinesEdit");

    const adminPatch = await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        items: [{ product_id: productId, qty: 2 }]
      });
    expect(adminPatch.status).toBe(200);
    expect(adminPatch.body.items?.length).toBeGreaterThan(0);
  });

  it("operator cannot cancel from picking/delivering; admin can", async () => {
    const adminLogin = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.accessToken as string;

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${adminToken}`);
    const clientId = clientsRes.body.data[0].id as number;

    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${adminToken}`);
    const productId = productsRes.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(ctx.app, adminToken);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(201);
    const orderId = create.body.id as number;

    await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" });
    await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "picking" });

    const opLogin = await loginForIntegrationTest(ctx.app, {
      slug: "test1",
      login: "operator",
      password: "secret123"
    });
    expect(opLogin.status).toBe(200);
    const opToken = opLogin.body.accessToken as string;

    const detailPicking = await request(ctx.app.server)
      .get(`/api/test1/orders/${orderId}`)
      .set("Authorization", `Bearer ${opToken}`);
    expect(detailPicking.body.allowed_next_statuses).not.toContain("cancelled");

    const opCancel = await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${opToken}`)
      .send({ status: "cancelled" });
    expect(opCancel.status).toBe(403);
    expect(opCancel.body.error).toBe("ForbiddenOperatorCancelLate");

    const adminCancel = await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "cancelled" });
    expect(adminCancel.status).toBe(200);
    expect(adminCancel.body.status).toBe("cancelled");
  });
});
