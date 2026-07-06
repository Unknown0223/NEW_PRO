import request from "supertest";
import { Prisma } from "@prisma/client";
import { expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { describeOrdersIntegrationSuite, mainWarehouseId } from "./orders.integration.harness";

describeOrdersIntegrationSuite("create and pricing", (ctx) => {
  it("POST order uses retail price and GET list", async () => {
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
    const warehouseId = await mainWarehouseId(ctx.app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 2 }]
      });

    expect(create.status).toBe(201);
    expect(create.body.items).toHaveLength(1);
    expect(create.body.total_sum).toBe("50000");
    expect(create.body.number).toBe(String(create.body.id));
    expect(create.body.allowed_next_statuses).toContain("confirmed");
    expect(create.body.allowed_next_statuses).toContain("cancelled");

    const patchOk = await request(ctx.app.server)
      .patch(`/api/test1/orders/${create.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "confirmed" });
    expect(patchOk.status).toBe(200);
    expect(patchOk.body.status).toBe("confirmed");
    expect(patchOk.body.status_logs).toHaveLength(1);
    expect(patchOk.body.status_logs[0].from_status).toBe("new");
    expect(patchOk.body.status_logs[0].to_status).toBe("confirmed");
    expect(patchOk.body.status_logs[0].user_login).toBe("admin");
    expect(patchOk.body.allowed_next_statuses).toContain("picking");

    const detail = await request(ctx.app.server)
      .get(`/api/test1/orders/${create.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.status_logs).toHaveLength(1);

    const patchBad = await request(ctx.app.server)
      .patch(`/api/test1/orders/${create.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "delivered" });
    expect(patchBad.status).toBe(400);
    expect(patchBad.body.error).toBe("InvalidTransition");

    const list = await request(ctx.app.server)
      .get("/api/test1/orders?page=1&limit=10")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.some((o: { id: number }) => o.id === create.body.id)).toBe(true);

    const listByClient = await request(ctx.app.server)
      .get(`/api/test1/orders?page=1&limit=50&client_id=${clientId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(listByClient.status).toBe(200);
    expect(
      listByClient.body.data.every((o: { client_id: number }) => o.client_id === clientId)
    ).toBe(true);
  });

  it("POST order with two lines sums retail totals", async () => {
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

    const p1 = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${token}`);
    const p2 = await request(ctx.app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-002")
      .set("Authorization", `Bearer ${token}`);
    const id1 = p1.body.data[0].id as number;
    const id2 = p2.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(ctx.app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [
          { product_id: id1, qty: 1 },
          { product_id: id2, qty: 1 }
        ]
      });

    expect(create.status).toBe(201);
    expect(create.body.items.filter((i: { is_bonus: boolean }) => !i.is_bonus)).toHaveLength(2);
    // Seed: 10% chegirma SKU-002 zakazda bo‘lsa butun yig‘indiga qo‘llanadi: 85000 * 0.9 = 76500
    expect(create.body.total_sum).toBe("76500");
  });

  it("POST order applies seed 6+1 qty bonus for 12 units", async () => {
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
    const warehouseId = await mainWarehouseId(ctx.app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 12 }]
      });

    expect(create.status).toBe(201);
    expect(create.body.total_sum).toBe("300000");
    expect(create.body.bonus_sum).toBe("50000");
    const bonusItems = create.body.items.filter((i: { is_bonus: boolean }) => i.is_bonus);
    expect(bonusItems).toHaveLength(1);
    expect(bonusItems[0].qty).toBe("2");
    expect(bonusItems[0].total).toBe("50000");
  });

  it("POST order applies 10% discount only when cart has SKU-002 (seed rule scope)", async () => {
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
      .get("/api/test1/products?page=1&limit=5&search=SKU-002")
      .set("Authorization", `Bearer ${token}`);
    const productId = productsRes.body.data[0].id as number;
    const warehouseId = await mainWarehouseId(ctx.app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 10 }]
      });

    expect(create.status).toBe(201);
    expect(create.body.total_sum).toBe("540000");
    expect(create.body.items.filter((i: { is_bonus: boolean }) => !i.is_bonus)).toHaveLength(1);
  });

  it("POST order sum bonus: 500k+ subtotal adds SKU-003 gift (seed)", async () => {
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
    const warehouseId = await mainWarehouseId(ctx.app, token);

    const create = await request(ctx.app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: ctx.seedAgentUserId,
        client_id: clientId,
        warehouse_id: warehouseId,
        items: [{ product_id: productId, qty: 20 }]
      });

    expect(create.status).toBe(201);
    expect(create.body.total_sum).toBe("500000");
    expect(create.body.items.some((i: { is_bonus: boolean; sku: string }) => i.is_bonus && i.sku === "SKU-003")).toBe(
      true
    );
  });
});
