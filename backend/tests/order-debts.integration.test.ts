import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

describe.skipIf(!dbReady)("reports order-debts (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /reports/order-debts returns list shape", async () => {
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
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    expect(res.body.summary).toBeTruthy();
    expect(typeof res.body.summary.total_remainder).toBe("string");
    expect(res.body.summary.currency).toBe("UZS");
  });

  it("GET /reports/order-debts/export returns xlsx", async () => {
    const login = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;

    const res = await request(app.server)
      .get("/api/test1/reports/order-debts/export?page=1&limit=10")
      .buffer(true)
      .parse((res2, callback) => {
        const chunks: Buffer[] = [];
        res2.on("data", (c: Buffer) => chunks.push(c));
        res2.on("end", () => callback(null, chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0)));
      })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/spreadsheet/);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect((res.body as Buffer).length).toBeGreaterThan(100);
  });
});
