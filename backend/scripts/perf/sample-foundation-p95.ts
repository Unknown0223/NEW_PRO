/**
 * Foundation: seed DB (test1) ustida asosiy GET marshrutlar uchun API P95 (supertest).
 *
 * Ishlatish:
 *   $env:DATABASE_URL = "postgresql://postgres:0223@localhost:15432/savdo_db"
 *   npm run perf:sample-p95
 *
 * Ixtiyoriy: P95_SAMPLES=6; FOUNDATION_P95_QUIET=1; P95_PROFILE=quick|full
 */
if (
  (process.env.FOUNDATION_P95_QUIET === "1" || process.env.P95_PROFILE === "quick") &&
  !process.env.LOG_LEVEL
) {
  process.env.LOG_LEVEL = "error";
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { buildApp } from "../../src/app";

const __dirname = dirname(fileURLToPath(import.meta.url));
const marker = join(__dirname, "../../tests/.db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

type Sample = { label: string; method: "get"; path: string };

const SAMPLES_QUICK: Sample[] = [
  { label: "orders", method: "get", path: "/api/test1/orders?page=1&limit=20" },
  { label: "clients", method: "get", path: "/api/test1/clients?page=1&limit=20" },
  { label: "stock-balances", method: "get", path: "/api/test1/stock/balances?page=1&limit=20&view=summary" },
  { label: "clients-references", method: "get", path: "/api/test1/clients/references" },
  {
    label: "reports-order-debts",
    method: "get",
    path: "/api/test1/reports/order-debts?page=1&limit=20"
  }
];

const SAMPLES_FULL: Sample[] = [
  ...SAMPLES_QUICK,
  { label: "products", method: "get", path: "/api/test1/products?page=1&limit=20" },
  { label: "dashboard-stats", method: "get", path: "/api/test1/dashboard/stats" },
  {
    label: "dashboard-supervisor",
    method: "get",
    path: "/api/test1/dashboard/supervisor?date=2026-05-01"
  },
  {
    label: "dashboard-sales",
    method: "get",
    path: "/api/test1/dashboard/sales?date_from=2026-01-01&date_to=2026-05-15"
  },
  {
    label: "reports-sales",
    method: "get",
    path: "/api/test1/reports/sales?from=2026-01-01&to=2026-12-31"
  }
];

function resolveSamples(): Sample[] {
  return process.env.P95_PROFILE === "quick" ? SAMPLES_QUICK : SAMPLES_FULL;
}

function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  let idx = Math.ceil(0.95 * sorted.length) - 1;
  if (idx < 0) idx = 0;
  if (idx >= sorted.length) idx = sorted.length - 1;
  return Math.round(sorted[idx]! * 10) / 10;
}

function toInventoryPath(path: string): string {
  return path.replace(/^\/api\/test1/, "/api/:slug").replace(/\?.*$/, "");
}

async function main() {
  if (!dbReady) {
    console.error("DB integration marker yo‘q. Avval: npx vitest run tests/contract-smoke.integration.test.ts");
    process.exit(1);
  }

  const profile = process.env.P95_PROFILE === "quick" ? "quick" : "full";
  const defaultIterations = profile === "quick" ? 4 : 8;
  const iterations = Math.max(2, Number.parseInt(process.env.P95_SAMPLES ?? String(defaultIterations), 10) || defaultIterations);
  const samples = resolveSamples();
  const app = buildApp();
  await app.ready();

  const login = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  if (login.status !== 200 || typeof login.body.accessToken !== "string") {
    console.error("Login failed:", login.status, login.body);
    await app.close();
    process.exit(1);
  }
  const token = login.body.accessToken as string;

  const rows: Array<{ label: string; path: string; count: number; p95_ms: number | null; max_ms: number }> = [];

  for (const s of samples) {
    const times: number[] = [];
    for (let i = 0; i <= iterations; i++) {
      const t0 = performance.now();
      const res = await request(app.server).get(s.path).set("Authorization", `Bearer ${token}`);
      const ms = performance.now() - t0;
      if (i === 0) continue;
      if (res.status >= 200 && res.status < 300) {
        times.push(ms);
      } else {
        console.warn(`[${s.label}] ${res.status} — ${s.path}`);
      }
    }
    const max = times.length ? Math.round(Math.max(...times) * 10) / 10 : 0;
    rows.push({
      label: s.label,
      path: toInventoryPath(s.path),
      count: times.length,
      p95_ms: p95(times),
      max_ms: max
    });
  }

  await app.close();

  const logDir = join(__dirname, "../../logs");
  mkdirSync(logDir, { recursive: true });
  const outName = profile === "quick" ? "foundation-p95-quick.json" : "foundation-p95-samples.json";
  const outPath = join(logDir, outName);
  writeFileSync(
    outPath,
    JSON.stringify({ at: new Date().toISOString(), profile, iterations, rows }, null, 2),
    "utf8"
  );

  console.log("\nlabel | path | count | p95_ms | max_ms");
  console.log("------|------|-------|--------|-------");
  for (const r of rows.sort((a, b) => (b.p95_ms ?? 0) - (a.p95_ms ?? 0))) {
    console.log(`${r.label} | ${r.path} | ${r.count} | ${r.p95_ms ?? "—"} | ${r.max_ms}`);
  }
  console.log(`\nJSON: ${outPath}`);
  console.log("Natijani .cursor/plans/db_slow_query_inventory.md P95 ustuniga qo‘ying (dev seed).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
