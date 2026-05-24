/**
 * Dashboard split API contract smoke (summary endpoints 200 + minimal schema).
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { contractSmokeDbReady, expectRequestIdHeader } from "./contract-smoke.harness";

const dbReady = contractSmokeDbReady;

async function adminToken(app: ReturnType<typeof buildApp>) {
  const login = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  expect(login.status).toBe(200);
  return login.body.accessToken as string;
}

describe("contract smoke (dashboard perf split)", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe.skipIf(!dbReady)("GET /api/test1/dashboard/* summary endpoints", () => {
    it("meta — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get("/api/test1/dashboard/meta")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("agents");
      expect(res.body).toHaveProperty("supervisors");
    });

    it("supervisor/summary — 200 + kpi", async () => {
      const token = await adminToken(app);
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app.server)
        .get(`/api/test1/dashboard/supervisor/summary?date=${today}`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("kpi");
      expect(res.body.kpi).toHaveProperty("total_sales_sum");
    });

    it("sales/summary — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get("/api/test1/dashboard/sales/summary?from=2026-01-01&to=2026-01-31")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("total_sales_summary");
      expect(res.body).toHaveProperty("akb_okb_block");
    });

    it("finance/summary — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get("/api/test1/dashboard/finance/summary?from=2026-01-01&to=2026-01-31")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("summary");
      expect(res.body.summary).toHaveProperty("total_sales_sum");
    });

    it("sales-monitoring/summary — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get("/api/test1/dashboard/sales-monitoring/summary?year=2026&month=1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expectRequestIdHeader(res);
      expect(res.body).toHaveProperty("plan_fact");
      expect(res.body).toHaveProperty("akb_okb");
    });

    it("sales-monitoring/charts — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get("/api/test1/dashboard/sales-monitoring/charts?year=2026&month=1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("category_sales");
    });

    it("sales-monitoring/tables sku — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get(
          "/api/test1/dashboard/sales-monitoring/tables?year=2026&month=1&table=sku_matrix&page=1&limit=10"
        )
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("sku_matrix");
      expect(Array.isArray(res.body.sku_matrix)).toBe(true);
    });

    it("supervisor/visits — 200", async () => {
      const token = await adminToken(app);
      const today = new Date().toISOString().slice(0, 10);
      const res = await request(app.server)
        .get(`/api/test1/dashboard/supervisor/visits?date=${today}&page=1&limit=10`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("visit_report");
    });

    it("sales/analytics — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get("/api/test1/dashboard/sales/analytics?from=2026-01-01&to=2026-01-31")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("sales_dynamics");
    });

    it("finance/debts — 200", async () => {
      const token = await adminToken(app);
      const res = await request(app.server)
        .get("/api/test1/dashboard/finance/debts?from=2026-01-01&to=2026-01-31&page=1&limit=10")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("clients_debt_list");
    });
  });
});
