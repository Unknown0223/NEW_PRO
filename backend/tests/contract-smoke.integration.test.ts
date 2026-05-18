/**
 * Foundation P0: `tests/contract-smoke.md` dagi yo‘llarning bir qismi — JSON xato kontrakti
 * (`error`, `requestId`) va `x-request-id` sarlavhasi.
 *
 * DB talab qilinadigan qismlar `describe.skipIf(!dbReady)` — CI da seed bo‘lsa ishlaydi.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

function expectRequestIdHeader(res: { headers: Record<string, unknown> }) {
  const raw = res.headers["x-request-id"] ?? res.headers["X-Request-Id"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  expect(v != null && String(v).trim() !== "").toBe(true);
}

function expectErrorContract(res: {
  status: number;
  body: Record<string, unknown>;
  headers: Record<string, unknown>;
}) {
  expect(res.body).toHaveProperty("error");
  expect(typeof res.body.error).toBe("string");
  expect(res.body).toHaveProperty("requestId");
  expect(typeof res.body.requestId).toBe("string");
  expect(String(res.body.requestId).trim()).not.toBe("");
  expectRequestIdHeader(res);
}

describe("contract smoke (foundation)", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health — 200 va x-request-id", async () => {
    const res = await request(app.server).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.time).toBe("string");
    expectRequestIdHeader(res);
  });

  it("GET /ready — 200 yoki 503; 503 da error kontrakt", async () => {
    const res = await request(app.server).get("/ready");
    expect([200, 503]).toContain(res.status);
    expectRequestIdHeader(res);
    if (res.status === 503) {
      expectErrorContract(res);
      expect(res.body.error).toBe("NotReady");
    } else {
      expect(res.body.status).toBe("ready");
      expect(res.body.database).toBe("ok");
    }
  });

  describe.skipIf(!dbReady)("seed DB (test1) — xato va muvaffaqiyat kontrakti", () => {
    it("POST /api/auth/login — noto‘g‘ri parol — 401 + INVALID_CREDENTIALS", async () => {
      const res = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "definitely-wrong-password-xyz"
      });
      expect(res.status).toBe(401);
      expectErrorContract(res);
      expect(res.body.error).toBe("INVALID_CREDENTIALS");
    });

    it("POST /api/auth/login — yaroqsiz body — 400 ValidationError", async () => {
      const res = await request(app.server).post("/api/auth/login").send({});
      expect(res.status).toBe(400);
      expectErrorContract(res);
      expect(res.body.error).toBe("ValidationError");
    });

    it("GET /api/{noto‘g‘ri slug}/... — 404 TenantNotFound", async () => {
      const res = await request(app.server).get("/api/__contract_no_tenant__/orders?page=1&limit=1");
      expect(res.status).toBe(404);
      expectErrorContract(res);
      expect(res.body.error).toBe("TenantNotFound");
    });

    it("POST /auth/refresh — yaroqsiz token — 401", async () => {
      const res = await request(app.server).post("/auth/refresh").send({ refreshToken: "invalid-token-xyz" });
      expect(res.status).toBe(401);
      expectErrorContract(res);
      expect(res.body.error).toBe("INVALID_REFRESH");
    });

    it("GET /api/auth/me — JWT bilan 200", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      expectRequestIdHeader(login);
      const token = login.body.accessToken as string;
      expect(typeof token).toBe("string");

      const me = await request(app.server).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
      expect(me.status).toBe(200);
      expectRequestIdHeader(me);
      expect(me.body.user?.tenantId).toBeDefined();
    });

    it("GET /api/test1/dashboard/stats — admin 200", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/dashboard/stats")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
    });

    it("GET /api/test1/access/me-permissions — JWT bilan 200", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/access/me-permissions")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body.data).toHaveProperty("keys");
      expect(Array.isArray(res.body.data.keys)).toBe(true);
    });

    it("GET /api/test1/products — admin 200", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/products?page=1&limit=5")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
    });

    it("GET /api/test1/clients/999999999 — 404 NotFound", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;
      const res = await request(app.server)
        .get("/api/test1/clients/999999999")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
      expectErrorContract(res);
      expect(res.body.error).toBe("NotFound");
    });

    it("GET /api/test1/orders va mavjud bo‘lmagan id — 404 NotFound kontrakt", async () => {
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "admin",
        password: "secret123"
      });
      expect(login.status).toBe(200);
      const token = login.body.accessToken as string;

      const list = await request(app.server).get("/api/test1/orders?page=1&limit=1").set("Authorization", `Bearer ${token}`);
      expect(list.status).toBe(200);
      expectRequestIdHeader(list);

      const nf = await request(app.server)
        .get("/api/test1/orders/999999999")
        .set("Authorization", `Bearer ${token}`);
      expect(nf.status).toBe(404);
      expectErrorContract(nf);
      expect(nf.body.error).toBe("NotFound");
    });
  });

  describe.skipIf(!dbReady)("RBAC regressiya smoke (P0 #3)", () => {
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
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "agent",
        password: "secret123"
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
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "agent",
        password: "secret123"
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
      const login = await request(app.server).post("/api/auth/login").send({
        slug: "test1",
        login: "agent",
        password: "secret123"
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
