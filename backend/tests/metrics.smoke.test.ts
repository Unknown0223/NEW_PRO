import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

describe("GET /metrics", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("dev muhitda Prometheus matn qaytaradi", async () => {
    const res = await request(app.server).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text/);
    expect(res.text).toContain("http_requests_total");
    expect(res.text).toContain("process_cpu_user_seconds_total");
  });

  it("health probe ishlaydi", async () => {
    const res = await request(app.server).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
