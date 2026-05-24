import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

const marker = join(__dirname, ".db-integration-ready");
export const contractSmokeDbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

export function expectRequestIdHeader(res: { headers: Record<string, unknown> }) {
  const raw = res.headers["x-request-id"] ?? res.headers["X-Request-Id"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  expect(v != null && String(v).trim() !== "").toBe(true);
}

export function expectErrorContract(res: {
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
