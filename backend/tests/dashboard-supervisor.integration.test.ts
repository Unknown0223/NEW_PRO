import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

describe.skipIf(!dbReady)("supervisor dashboard API (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    "GET /api/test1/dashboard/supervisor returns snapshot quickly",
    async () => {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    const started = Date.now();
    const res = await request(app.server)
      .get("/api/test1/dashboard/supervisor?date=2026-05-06")
      .set("Authorization", `Bearer ${token}`);
    const ms = Date.now() - started;

    expect(res.status).toBe(200);
    expect(res.body?.kpi).toBeTruthy();
    expect(typeof res.body.kpi.total_sales_sum).toBe("string");
    expect(typeof res.body.kpi.cash_sales_sum).toBe("string");
    expect(res.body.visit_report?.rows).toBeTruthy();
    expect(Array.isArray(res.body.visit_report.rows)).toBe(true);
    expect(ms).toBeLessThan(30_000);
    },
    30_000
  );
});
