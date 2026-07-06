/**
 * Foundation P0: RBAC regressiya contract smoke.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { contractSmokeDbReady, expectErrorContract, expectRequestIdHeader } from "./contract-smoke.harness";
import { loginForIntegrationTest } from "./test-auth.helpers";

describe.skipIf(!contractSmokeDbReady)("contract smoke (RBAC)", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("RBAC regressiya smoke (P0 #3)", () => {
    it("admin GET /reports/sales — ruxsat bor, 200 + header", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/reports/sales?from=2026-01-01&to=2026-12-31")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("data");
    });

    it("admin GET /clients/references — 200", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/clients/references")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("categories");
    });

    it("admin GET /reports/order-debts — 200 + list shape", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/reports/order-debts?page=1&limit=5")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("summary");
    });

    it("admin GET /reports/cash-flow — query yo‘q — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/reports/cash-flow")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("admin POST /reports/report-builder/dataset — body yo‘q — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .post("/api/test1/reports/report-builder/dataset")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("admin GET /reports/income-report — from/to yo‘q — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/reports/income-report")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("agent POST /mobile/orders/enqueue — yaroqsiz body — 400 yoki 403 (ruxsat)", async () => {
      const login = await loginForIntegrationTest(app, {
        slug: "test1",
        login: "agent",
        password: "111111"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .post("/api/test1/mobile/orders/enqueue")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expectErrorContract(res);
      if (res.status === 403) {
        expect(String(res.body.error)).toMatch(/Forbidden/);
      } else {
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("ValidationError");
      }
    });

    it("agent GET /orders/exchange-source-availability — rol cheklovi — 403 ForbiddenRole", async () => {
      const login = await loginForIntegrationTest(app, {
        slug: "test1",
        login: "agent",
        password: "111111"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/orders/exchange-source-availability?client_id=1&order_ids=1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expectErrorContract(res);
      expect(res.body.error).toBe("ForbiddenRole");
    });

    it("agent GET /access/users — access.manage yo‘q — 403 ForbiddenPermission", async () => {
      const login = await loginForIntegrationTest(app, {
        slug: "test1",
        login: "agent",
        password: "111111"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server).get("/api/test1/access/users").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expectErrorContract(res);
      expect(res.body.error).toBe("ForbiddenPermission");
      const body = res.body as { permission?: string };
      expect(body.permission).toBe("access.manage");
    });

    it("admin PATCH /settings/profile — yaroqsiz name — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .patch("/api/test1/settings/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "" });
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("POST /api/test1/orders — yaroqsiz body — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .post("/api/test1/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({ client_id: 1 });
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("GET /api/test1/stock/balances — admin 200", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/stock/balances?page=1&limit=5")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
    });

    it("POST /api/test1/products — yaroqsiz body — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .post("/api/test1/products")
        .set("Authorization", `Bearer ${token}`)
        .send({ sku: "x" });
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("POST /api/test1/payments — yaroqsiz body — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .post("/api/test1/payments")
        .set("Authorization", `Bearer ${token}`)
        .send({ client_id: 1 });
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("PATCH /api/test1/orders/1/status — bo‘sh body — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .patch("/api/test1/orders/1/status")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("PATCH /api/test1/clients/1 — bo‘sh body — 400 ValidationError", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .patch("/api/test1/clients/1")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("test1 JWT + boshqa tenant slug — 403 CrossTenantDenied", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server).get("/api/demo/orders?page=1&limit=1").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expectErrorContract(res);
      expect(res.body.error).toBe("CrossTenantDenied");
    });
  });
});
