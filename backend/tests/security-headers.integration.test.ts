import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const app = buildApp();

describe("HTTP security headers (helmet)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("sets X-Content-Type-Options and X-Frame-Options on /health", async () => {
    const response = await request(app.server).get("/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("sets Content-Security-Policy on API responses", async () => {
    const response = await request(app.server).get("/health");

    expect(response.headers["content-security-policy"]).toMatch(/default-src 'self'/);
  });
});
