import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { mainWarehouseId } from "./orders.integration.harness";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("payment workflow (integration)", () => {
  const app = buildApp();
  let token = "";
  let clientId = 0;
  let cashDeskId = 0;

  beforeAll(async () => {
    await app.ready();
    const login = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(login.status).toBe(200);
    token = login.body.accessToken as string;

    const clientsRes = await request(app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${token}`);
    expect(clientsRes.status).toBe(200);
    clientId = clientsRes.body.data[0].id as number;

    const desksRes = await request(app.server)
      .get("/api/test1/cash-desks")
      .set("Authorization", `Bearer ${token}`);
    expect(desksRes.status).toBe(200);
    const desks = desksRes.body.data as { id: number; is_active: boolean }[];
    const active = desks.find((d) => d.is_active) ?? desks[0];
    expect(active).toBeDefined();
    cashDeskId = active!.id;

    await mainWarehouseId(app, token);
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates confirmed payment and returns detail", async () => {
    const createRes = await request(app.server)
      .post("/api/test1/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: clientId,
        amount: 50_000,
        payment_type: "cash_uzs",
        cash_desk_id: cashDeskId,
        note: "[vitest-payment-workflow]"
      });
    expect(createRes.status).toBe(201);
    const created = createRes.body.data ?? createRes.body;
    const paymentId = created.id as number;
    expect(paymentId).toBeGreaterThan(0);
    expect(created.workflow_status).toBe("confirmed");

    const detailRes = await request(app.server)
      .get(`/api/test1/payments/${paymentId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detailRes.status).toBe(200);
    const detailPayment =
      detailRes.body.payment ?? detailRes.body.data?.payment ?? detailRes.body.data ?? detailRes.body;
    expect(detailPayment.id).toBe(paymentId);
    expect(Number(detailPayment.amount)).toBe(50_000);

    const listRes = await request(app.server)
      .get(`/api/test1/payments?page=1&limit=5&client_id=${clientId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const ids = (listRes.body.data as { id: number }[]).map((p) => p.id);
    expect(ids).toContain(paymentId);
  });

  it("lists payments filtered by client after create", async () => {
    const createRes = await request(app.server)
      .post("/api/test1/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: clientId,
        amount: 25_000,
        payment_type: "cash_uzs",
        cash_desk_id: cashDeskId,
        note: "[vitest-payment-workflow-list]"
      });
    expect(createRes.status).toBe(201);
    const created = createRes.body.data ?? createRes.body;
    const paymentId = created.id as number;

    const listRes = await request(app.server)
      .get(`/api/test1/payments?page=1&limit=20&client_id=${clientId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const rows = listRes.body.data as { id: number; workflow_status: string }[];
    const row = rows.find((p) => p.id === paymentId);
    expect(row).toBeDefined();
    expect(row!.workflow_status).toBe("confirmed");
  });

  it("rejects payment with invalid client", async () => {
    const res = await request(app.server)
      .post("/api/test1/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: 9_999_999,
        amount: 1_000,
        payment_type: "cash_uzs",
        cash_desk_id: cashDeskId
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
