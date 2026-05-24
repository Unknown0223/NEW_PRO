/**
 * Foundation P0: infra + seed DB contract smoke.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import {
  contractSmokeDbReady,
  expectErrorContract,
  expectRequestIdHeader
} from "./contract-smoke.harness";

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
});
