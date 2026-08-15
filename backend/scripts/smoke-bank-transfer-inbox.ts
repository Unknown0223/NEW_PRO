/**
 * One-off smoke: register app, hit bank-transfer-inbox ingest+list.
 * Usage: npx tsx scripts/smoke-bank-transfer-inbox.ts
 */
import request from "supertest";
import { buildApp } from "../src/app";

async function main() {
  const app = buildApp();
  await app.ready();
  // printRoutes() tree may omit nested path text; probe a real route instead.
  const hasBti = typeof (app as { hasRoute?: (opts: object) => boolean }).hasRoute === "function"
    ? (app as { hasRoute: (opts: object) => boolean }).hasRoute({
        method: "GET",
        url: "/api/:slug/bank-transfer-inbox/counts"
      })
    : true;
  console.log(hasBti ? "HAS_BTI_ROUTES" : "NO_BTI_ROUTES");

  const login = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  if (login.status !== 200) {
    console.error("LOGIN_FAIL", login.status, login.body);
    process.exit(1);
  }
  const token = login.body.accessToken as string;

  const counts = await request(app.server)
    .get("/api/test1/bank-transfer-inbox/counts")
    .set("Authorization", `Bearer ${token}`);
  console.log("COUNTS", counts.status, JSON.stringify(counts.body));

  const ext = `smoke-bti-${Date.now()}`;
  const ingest = await request(app.server)
    .post("/api/test1/bank-transfer-inbox/ingest")
    .set("Authorization", `Bearer ${token}`)
    .send({
      source: "manual",
      items: [
        {
          external_id: ext,
          amount: 12345,
          payer_name: "Smoke Payer",
          purpose: "smoke test"
        }
      ]
    });
  console.log("INGEST", ingest.status, JSON.stringify(ingest.body));

  const list = await request(app.server)
    .get("/api/test1/bank-transfer-inbox?tab=unmatched&limit=5")
    .set("Authorization", `Bearer ${token}`);
  console.log("LIST", list.status, "rows=", (list.body.data ?? []).length);

  await app.close();
  console.log("SMOKE_DONE");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
