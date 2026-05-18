/**
 * Bir martalik order-debts API vaqti (warmup + 3 o‘lchov).
 *   $env:DATABASE_URL = "postgresql://postgres:0223@localhost:15432/savdo_db"
 *   npx tsx scripts/perf/bench-order-debts-once.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { buildApp } from "../../src/app";

const marker = join(__dirname, "../../tests/.db-integration-ready");
if (!existsSync(marker) || readFileSync(marker, "utf8").trim() !== "1") {
  console.error("DB marker yo‘q — avval contract-smoke yoki seed.");
  process.exit(1);
}

const path = "/api/test1/reports/order-debts?page=1&limit=20";

async function main() {
  const app = buildApp();
  await app.ready();
  const login = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  if (login.status !== 200) {
    console.error("login failed", login.status);
    process.exit(1);
  }
  const token = login.body.accessToken as string;

  const times: number[] = [];
  for (let i = 0; i <= 3; i++) {
    const t0 = performance.now();
    const res = await request(app.server).get(path).set("Authorization", `Bearer ${token}`);
    const ms = performance.now() - t0;
    if (i === 0) {
      console.log(`warmup: ${res.status} ${Math.round(ms)} ms`);
      continue;
    }
    if (res.status !== 200) {
      console.error(`request failed: ${res.status}`, res.body);
      process.exit(1);
    }
    times.push(ms);
    console.log(`run ${i}: ${Math.round(ms)} ms`);
  }
  await app.close();
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)]!;
  console.log(`p95 (3 runs): ${Math.round(p95)} ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
