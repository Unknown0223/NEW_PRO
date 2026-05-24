import request from "supertest";
import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { describeOrdersIntegrationSuite, mainWarehouseId } from "./orders.integration.harness";

describeOrdersIntegrationSuite("patch and meta", (ctx) => {
  it("PATCH orders/:id replaces payment lines and recomputes auto bonus", async () => {
    const loginResponse = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${token}`);
    const clientId = clientsRes.body.data[0].id as number;

    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${token}`);
    const productId = productsRes.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(201);
    expect(create.body.bonus_sum).toBe("0");

    const patched = await request(ctx.app.server)
      .patch(`/api/test1/orders/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ product_id: productId, qty: 12 }]
      });
    expect(patched.status).toBe(200);
    expect(Number.parseFloat(patched.body.bonus_sum)).toBeGreaterThan(0);
    const bonusLines = patched.body.items.filter((i: { is_bonus: boolean }) => i.is_bonus);
    expect(bonusLines.length).toBeGreaterThan(0);
    const lineLogs = (patched.body.change_logs as { action: string; user_login: string | null }[]).filter(
      (c) => c.action === "lines"
    );
    expect(lineLogs.length).toBe(1);
    expect(lineLogs[0].user_login).toBe("admin");
  });

  it("PATCH orders/:id/meta appends change_logs", async () => {
    const loginResponse = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    const whRes = await request(ctx.app.server)
      .get("/api/test1/warehouses")
      .set("Authorization", `Bearer ${token}`);
    expect(whRes.status).toBe(200);
    const warehouses = whRes.body.data as { id: number; name: string }[];
    expect(warehouses.length).toBeGreaterThanOrEqual(2);
    const whMain = await mainWarehouseId(app, token);
    const whB = warehouses.find((w) => w.id !== whMain)?.id ?? warehouses[1].id;

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${token}`);
    const clientId = clientsRes.body.data[0].id as number;

    /* Oldingi testlar SKU-001 zaxirasini kamaytirishi mumkin — SKU-003 seedda kamroq tortiladi */
    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-003")
      .set("Authorization", `Bearer ${token}`);
    const productId = productsRes.body.data[0].id as number;

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: whMain,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(201);
    const orderId = create.body.id as number;

    const patched = await request(ctx.app.server)
      .patch(`/api/test1/orders/${orderId}/meta`)
      .set("Authorization", `Bearer ${token}`)
      .send({ warehouse_id: whB });
    expect(patched.status).toBe(200);
    const metaLogs = (patched.body.change_logs as { action: string }[]).filter(
      (c) => c.action === "meta"
    );
    expect(metaLogs.length).toBe(1);
  });

  it("PATCH orders/:id returns OrderNotEditable when status is picking", async () => {
    const loginResponse = await request(ctx.app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    const clientsRes = await request(ctx.app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${token}`);
    const clientId = clientsRes.body.data[0].id as number;

    const productsRes = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${token}`);
    const productId = productsRes.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(201);

    await request(ctx.app.server)
      .patch(`/api/test1/orders/${create.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" });
    await request(ctx.app.server)
      .patch(`/api/test1/orders/${create.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "picking" });

    const bad = await request(ctx.app.server)
      .patch(`/api/test1/orders/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [{ product_id: productId, qty: 2 }]
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("OrderNotEditable");
  });
});
