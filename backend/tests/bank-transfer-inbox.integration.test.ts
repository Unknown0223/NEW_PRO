import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("bank-transfer-inbox (integration)", () => {
  const app = buildApp();
  let token = "";
  let clientId = 0;
  let clientInn: string | null = null;

  beforeAll(async () => {
    await app.ready();
    const login = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(login.status).toBe(200);
    token = login.body.accessToken as string;

    const clientsRes = await request(app.server)
      .get("/api/test1/clients?page=1&limit=20")
      .set("Authorization", `Bearer ${token}`);
    expect(clientsRes.status).toBe(200);
    const rows = clientsRes.body.data as { id: number; inn?: string | null }[];
    const withInn = rows.find((c) => c.inn && String(c.inn).replace(/\D/g, "").length >= 9);
    const pick = withInn ?? rows[0];
    expect(pick).toBeDefined();
    clientId = pick!.id;
    clientInn = withInn?.inn ?? null;
  });

  afterAll(async () => {
    await app.close();
  });

  it("ingests manual transfer and lists inbox", async () => {
    const ext = `vitest-bti-${Date.now()}`;
    const ingest = await request(app.server)
      .post("/api/test1/bank-transfer-inbox/ingest")
      .set("Authorization", `Bearer ${token}`)
      .send({
        source: "manual",
        items: [
          {
            external_id: ext,
            amount: 77_777,
            payer_name: "Vitest Payer",
            payer_inn: clientInn,
            purpose: "vitest bank transfer"
          }
        ]
      });
    expect([200, 201]).toContain(ingest.status);
    expect(ingest.body.data.created).toBeGreaterThanOrEqual(1);
    const inboxId = ingest.body.data.results[0]?.inbox_id as number;
    expect(inboxId).toBeGreaterThan(0);

    const list = await request(app.server)
      .get("/api/test1/bank-transfer-inbox?tab=all&limit=10")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const ids = (list.body.data as { id: number }[]).map((r) => r.id);
    expect(ids).toContain(inboxId);

    const detail = await request(app.server)
      .get(`/api/test1/bank-transfer-inbox/${inboxId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.id).toBe(inboxId);

    // Assign if unmatched
    if (detail.body.data.status === "unmatched" || detail.body.data.status === "ambiguous") {
      const assign = await request(app.server)
        .post(`/api/test1/bank-transfer-inbox/${inboxId}/assign`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          client_id: clientId,
          comment: "vitest assign comment",
          create_payment: true
        });
      expect(assign.status).toBe(200);
      expect(assign.body.data.payment_id).toBeTruthy();
      expect(assign.body.data.status).toBe("pending");
    } else if (detail.body.data.status === "matched") {
      const createPay = await request(app.server)
        .post(`/api/test1/bank-transfer-inbox/${inboxId}/create-payment`)
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect([200, 201]).toContain(createPay.status);
      expect(createPay.body.data.payment_id).toBeTruthy();
    }

    // Duplicate external_id skipped
    const dup = await request(app.server)
      .post("/api/test1/bank-transfer-inbox/ingest")
      .set("Authorization", `Bearer ${token}`)
      .send({
        source: "manual",
        items: [{ external_id: ext, amount: 1, payer_name: "dup" }]
      });
    expect([200, 201]).toContain(dup.status);
    expect(dup.body.data.skipped).toBeGreaterThanOrEqual(1);
  });

  it("tags manual create with channel=manual and filters by channel", async () => {
    const manual = await request(app.server)
      .post("/api/test1/bank-transfer-inbox/manual")
      .set("Authorization", `Bearer ${token}`)
      .send({
        amount: 12_345,
        client_id: clientId,
        comment: "vitest manual channel",
        create_payment: true
      });
    expect([200, 201]).toContain(manual.status);
    expect(manual.body.data.source).toBe("manual");
    expect(manual.body.data.channel).toBe("manual");
    expect(manual.body.data.payment_id).toBeTruthy();

    const listManual = await request(app.server)
      .get("/api/test1/bank-transfer-inbox?tab=all&channel=manual&limit=50")
      .set("Authorization", `Bearer ${token}`);
    expect(listManual.status).toBe(200);
    const manualIds = (listManual.body.data as { id: number; channel: string }[]).map((r) => r.id);
    expect(manualIds).toContain(manual.body.data.id as number);
    for (const r of listManual.body.data as { channel: string }[]) {
      expect(r.channel).toBe("manual");
    }

    const bankIngest = await request(app.server)
      .post("/api/test1/bank-transfer-inbox/ingest")
      .set("Authorization", `Bearer ${token}`)
      .send({
        source: "excel",
        items: [
          {
            external_id: `vitest-bti-excel-${Date.now()}`,
            amount: 55_555,
            payer_name: "Excel Payer"
          }
        ]
      });
    expect([200, 201]).toContain(bankIngest.status);
    const bankId = bankIngest.body.data.results[0]?.inbox_id as number;

    const listBank = await request(app.server)
      .get("/api/test1/bank-transfer-inbox?tab=all&channel=bank_verified&limit=50")
      .set("Authorization", `Bearer ${token}`);
    expect(listBank.status).toBe(200);
    const bankRows = listBank.body.data as { id: number; channel: string; source: string }[];
    expect(bankRows.some((r) => r.id === bankId)).toBe(true);
    expect(bankRows.every((r) => r.channel === "bank_verified")).toBe(true);
    expect(bankRows.every((r) => r.source !== "manual")).toBe(true);
  });

  it("rejects reassign without comment", async () => {
    const ingest = await request(app.server)
      .post("/api/test1/bank-transfer-inbox/ingest")
      .set("Authorization", `Bearer ${token}`)
      .send({
        source: "manual",
        items: [
          {
            external_id: `vitest-bti-nocmt-${Date.now()}`,
            amount: 1000,
            payer_name: "No comment"
          }
        ]
      });
    const inboxId = ingest.body.data.results[0]?.inbox_id as number;
    const bad = await request(app.server)
      .post(`/api/test1/bank-transfer-inbox/${inboxId}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ client_id: clientId, comment: "ab" });
    expect(bad.status).toBe(400);
  });
});
