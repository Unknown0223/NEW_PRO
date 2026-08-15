/**
 * Quick CSV/import path smoke for bank-transfer-inbox.
 * Usage: npx tsx scripts/smoke-bank-transfer-import.ts
 */
import request from "supertest";
import { buildApp } from "../src/app";

async function main() {
  const app = buildApp();
  await app.ready();
  const login = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  if (login.status !== 200) {
    console.error("LOGIN_FAIL", login.status);
    process.exit(1);
  }
  const token = login.body.accessToken as string;

  const csv = [
    "amount,inn,payer_name,purpose",
    `25000,,CSV Smoke Payer,csv import smoke ${Date.now()}`,
    "not-a-number,,Bad Row,should error"
  ].join("\n");

  const res = await request(app.server)
    .post("/api/test1/bank-transfer-inbox/import")
    .set("Authorization", `Bearer ${token}`)
    .send({ source: "csv", csv });

  console.log("IMPORT", res.status, JSON.stringify(res.body));
  if (![200, 201].includes(res.status)) {
    console.error("IMPORT_SMOKE_FAIL status", res.status);
    await app.close();
    process.exit(1);
  }
  const created = Number(res.body?.data?.created ?? 0);
  const rowErrors = res.body?.data?.row_errors;
  if (created < 1) {
    console.error("IMPORT_SMOKE_FAIL expected created>=1", res.body?.data);
    await app.close();
    process.exit(1);
  }
  console.log("IMPORT_CREATED", created, "ROW_ERRORS", Array.isArray(rowErrors) ? rowErrors.length : 0);
  await app.close();
  console.log("IMPORT_SMOKE_DONE");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
