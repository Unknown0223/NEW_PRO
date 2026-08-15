/**
 * Smoke: assign → reassign → confirm → reassign rejected.
 * Usage: npx tsx scripts/smoke-bank-transfer-assign.ts
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
  const token = login.body.accessToken as string;

  const clients = await request(app.server)
    .get("/api/test1/clients?page=1&limit=10")
    .set("Authorization", `Bearer ${token}`);
  const rows = clients.body.data as { id: number }[];
  const clientId = rows[0]!.id;
  const otherId = rows.find((c) => c.id !== clientId)?.id ?? clientId;

  const ext = `smoke-assign-${Date.now()}`;
  const ingest = await request(app.server)
    .post("/api/test1/bank-transfer-inbox/ingest")
    .set("Authorization", `Bearer ${token}`)
    .send({
      source: "manual",
      items: [{ external_id: ext, amount: 5000, payer_name: "X" }]
    });
  const id = ingest.body.data.results[0].inbox_id as number;

  const bad = await request(app.server)
    .post(`/api/test1/bank-transfer-inbox/${id}/assign`)
    .set("Authorization", `Bearer ${token}`)
    .send({ client_id: clientId, comment: "ab" });
  console.log("SHORT_COMMENT", bad.status);

  const assign = await request(app.server)
    .post(`/api/test1/bank-transfer-inbox/${id}/assign`)
    .set("Authorization", `Bearer ${token}`)
    .send({ client_id: clientId, comment: "smoke assign ok", create_payment: true });
  console.log(
    "ASSIGN",
    assign.status,
    assign.body.data?.status,
    "payment=",
    assign.body.data?.payment_id
  );
  const paymentId = assign.body.data.payment_id as number;

  const re = await request(app.server)
    .post(`/api/test1/bank-transfer-inbox/${id}/reassign`)
    .set("Authorization", `Bearer ${token}`)
    .send({ client_id: otherId, comment: "redirect to other client" });
  console.log("REASSIGN", re.status, "assigned=", re.body.data?.assigned_client_id);

  const confirm = await request(app.server)
    .post(`/api/test1/payments/${paymentId}/confirm`)
    .set("Authorization", `Bearer ${token}`)
    .send({});
  console.log("CONFIRM", confirm.status);

  const reConf = await request(app.server)
    .post(`/api/test1/bank-transfer-inbox/${id}/reassign`)
    .set("Authorization", `Bearer ${token}`)
    .send({ client_id: clientId, comment: "should fail after confirm" });
  console.log(
    "REASSIGN_AFTER_CONFIRM",
    reConf.status,
    reConf.body?.message || reConf.body?.error || ""
  );

  const detail = await request(app.server)
    .get(`/api/test1/bank-transfer-inbox/${id}`)
    .set("Authorization", `Bearer ${token}`);
  console.log("FINAL_STATUS", detail.body.data?.status);

  await app.close();
  console.log("ASSIGN_SMOKE_DONE");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
