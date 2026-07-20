import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

describe.skipIf(!dbReady)("daily-kpi day matrix", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET ?day= returns 200 matrix", async () => {
    const login = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;

    const res = await request(app.server)
      .get("/api/test1/plans/daily-kpi?day=2026-07-20")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data?.day).toBe("2026-07-20");
    expect(Array.isArray(res.body.data?.agents)).toBe(true);
    expect(Array.isArray(res.body.data?.kpi_groups)).toBe(true);
    if (res.body.data.agents.length > 0) {
      expect(res.body.data.agents[0]).toHaveProperty("code");
      expect(res.body.data.agents[0]).toHaveProperty("branch");
    }
  });

  it("GET without day/month returns 400", async () => {
    const login = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    const token = login.body.accessToken as string;

    const res = await request(app.server)
      .get("/api/test1/plans/daily-kpi")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });
});
