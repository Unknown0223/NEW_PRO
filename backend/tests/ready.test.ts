import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app";

describe("GET /ready", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns ready without token when INTERNAL_HEALTH_TOKEN unset", async () => {
    const response = await request(app.server).get("/ready");
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(600);
  });

  it("rejects wrong x-internal-token when INTERNAL_HEALTH_TOKEN is set", async () => {
    vi.stubEnv("INTERNAL_HEALTH_TOKEN", "test-internal-health-token-32");
    vi.resetModules();
    try {
      const { buildApp: buildGuardedApp } = await import("../src/app");
      const guarded = buildGuardedApp();
      await guarded.ready();
      const bad = await request(guarded.server)
        .get("/ready")
        .set("x-internal-token", "wrong");
      expect(bad.status).toBe(401);
      const ok = await request(guarded.server)
        .get("/ready")
        .set("x-internal-token", "test-internal-health-token-32");
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe("ready");
      await guarded.close();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
