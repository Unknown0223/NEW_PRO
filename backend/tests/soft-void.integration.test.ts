import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loginForIntegrationTest } from "./test-auth.helpers";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

type AuditRow = { action: string; entity_type: string; entity_id: string };

describe.skipIf(!dbReady)("soft-void / restore (integration)", () => {
  const app = buildApp();
  let token = "";
  let clientId = 0;
  let cashDeskId = 0;

  beforeAll(async () => {
    await app.ready();
    const login = await loginForIntegrationTest(app, {
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(login.status).toBe(200);
    token = login.body.accessToken as string;

    const clientsRes = await request(app.server)
      .get("/api/test1/clients?page=1&limit=5&search=Asosiy")
      .set("Authorization", `Bearer ${token}`);
    expect(clientsRes.status).toBe(200);
    clientId = clientsRes.body.data[0].id as number;

    const desksRes = await request(app.server)
      .get("/api/test1/cash-desks")
      .set("Authorization", `Bearer ${token}`);
    expect(desksRes.status).toBe(200);
    const desks = desksRes.body.data as { id: number; is_active: boolean }[];
    cashDeskId = (desks.find((d) => d.is_active) ?? desks[0])!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function auditActions(entityType: string, entityId: number | string): Promise<string[]> {
    const res = await request(app.server)
      .get(`/api/test1/audit-events?entity_type=${entityType}&entity_id=${entityId}&limit=30`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const rows = res.body.data as AuditRow[];
    return rows.map((r) => r.action);
  }

  it("payment: void → archive list → restore → active list + audit", async () => {
    const createRes = await request(app.server)
      .post("/api/test1/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: clientId,
        amount: 12_345,
        payment_type: "cash_uzs",
        cash_desk_id: cashDeskId,
        note: "[vitest-soft-void-payment]"
      });
    expect(createRes.status).toBe(201);
    const created = createRes.body.data ?? createRes.body;
    const paymentId = created.id as number;

    const voidRes = await request(app.server)
      .delete(`/api/test1/payments/${paymentId}?cancel_reason_ref=vitest-void`)
      .set("Authorization", `Bearer ${token}`);
    expect(voidRes.status).toBe(204);

    const activeList = await request(app.server)
      .get(`/api/test1/payments?page=1&limit=50&client_id=${clientId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(activeList.status).toBe(200);
    expect((activeList.body.data as { id: number }[]).some((p) => p.id === paymentId)).toBe(false);

    const archiveList = await request(app.server)
      .get(`/api/test1/payments?page=1&limit=50&client_id=${clientId}&payment_status=deleted`)
      .set("Authorization", `Bearer ${token}`);
    expect(archiveList.status).toBe(200);
    expect((archiveList.body.data as { id: number }[]).some((p) => p.id === paymentId)).toBe(true);

    const restoreRes = await request(app.server)
      .post(`/api/test1/payments/${paymentId}/restore`)
      .set("Authorization", `Bearer ${token}`)
      .send({ comment: "vitest restore" });
    expect(restoreRes.status).toBe(204);

    const activeAfter = await request(app.server)
      .get(`/api/test1/payments?page=1&limit=50&client_id=${clientId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(activeAfter.status).toBe(200);
    expect((activeAfter.body.data as { id: number }[]).some((p) => p.id === paymentId)).toBe(true);

    const actions = await auditActions("finance", paymentId);
    expect(actions).toContain("payment.void");
    expect(actions).toContain("payment.restore");
  });

  it("catalog brand: deactivate → list excludes → restore → list includes + audit", async () => {
    const name = `SV-Brand_${Date.now()}`;
    const create = await request(app.server)
      .post("/api/test1/catalog/brands")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, code: `SVB${Date.now() % 1_000_000}` });
    expect(create.status).toBe(201);
    const brandId = create.body.id as number;

    const del = await request(app.server)
      .delete(`/api/test1/catalog/brands/${brandId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(del.body.is_active).toBe(false);

    const activeList = await request(app.server)
      .get("/api/test1/catalog/brands?page=1&limit=50&is_active=true")
      .set("Authorization", `Bearer ${token}`);
    expect(activeList.status).toBe(200);
    expect((activeList.body.data as { id: number }[]).some((b) => b.id === brandId)).toBe(false);

    const inactiveList = await request(app.server)
      .get("/api/test1/catalog/brands?page=1&limit=50&is_active=false&include_inactive=true")
      .set("Authorization", `Bearer ${token}`);
    expect(inactiveList.status).toBe(200);
    expect((inactiveList.body.data as { id: number }[]).some((b) => b.id === brandId)).toBe(true);

    const restore = await request(app.server)
      .post(`/api/test1/catalog/brands/${brandId}/restore`)
      .set("Authorization", `Bearer ${token}`);
    expect(restore.status).toBe(200);
    expect(restore.body.is_active).toBe(true);

    const activeAfter = await request(app.server)
      .get("/api/test1/catalog/brands?page=1&limit=50&is_active=true")
      .set("Authorization", `Bearer ${token}`);
    expect(activeAfter.status).toBe(200);
    expect((activeAfter.body.data as { id: number }[]).some((b) => b.id === brandId)).toBe(true);

    const actions = await auditActions("product_brand", brandId);
    expect(actions).toContain("soft_delete");
    expect(actions).toContain("reactivate");
  });

  // Order status rollback (superseded_at on orderStatusLog): skipped — full order harness too heavy for this file.
  it.skip("order status rollback keeps superseded_at rows (needs heavy order harness)", () => {
    // See order.lifecycle + orderStatusLog.superseded_at (Phase 1).
  });
});
