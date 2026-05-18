import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

async function adminToken(): Promise<string> {
  const loginResponse = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  expect(loginResponse.status).toBe(200);
  return loginResponse.body.accessToken as string;
}

describe.skipIf(!dbReady)("client-qr-codes API (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/:slug/client-qr-codes/stats returns counters", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .get("/api/test1/client-qr-codes/stats")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_qr: expect.any(Number),
      attached_qr: expect.any(Number),
      free_qr: expect.any(Number),
      status_new: expect.any(Number),
      status_printed: expect.any(Number),
      status_attached: expect.any(Number),
      status_detached: expect.any(Number),
      clients_without_qr: expect.any(Number)
    });
  });

  it("GET /api/:slug/client-qr-codes returns paginated list", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .get("/api/test1/client-qr-codes?page=1&limit=5")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(5);
    if (res.body.data.length > 0) {
      const row = res.body.data[0] as Record<string, unknown>;
      expect(row).toMatchObject({
        id: expect.any(Number),
        qr_code: expect.any(String),
        status: expect.any(String)
      });
    }
  });

  it("GET /api/:slug/client-qr-codes/clients-without-qr returns list", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .get("/api/test1/client-qr-codes/clients-without-qr?page=1&limit=3")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });

  it("POST /api/:slug/client-qr-codes/generate creates free QR rows", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .post("/api/test1/client-qr-codes/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ count: 2 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ created: expect.any(Number) });
    expect((res.body.created as number) >= 2).toBe(true);
  });

  it("POST generate rejects count above max", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .post("/api/test1/client-qr-codes/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ count: 99_999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
  });

  it("GET /api/:slug/client-qr-codes/export returns CSV", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .get("/api/test1/client-qr-codes/export?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(10);
    expect(res.text).toContain("qr_code");
  });

  it("GET clients-without-qr/export returns CSV", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .get("/api/test1/client-qr-codes/clients-without-qr/export")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("id");
    expect(res.text).toContain("name");
  });

  it("bind and unbind cycle on a free QR", async () => {
    const token = await adminToken();

    await request(app.server)
      .post("/api/test1/client-qr-codes/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ count: 1 })
      .expect(201);

    const listFree = await request(app.server)
      .get("/api/test1/client-qr-codes?page=1&limit=30&attached=no")
      .set("Authorization", `Bearer ${token}`);
    expect(listFree.status).toBe(200);
    const rows = listFree.body.data as Array<{ id: number; client_id: number | null }>;
    const free = rows.find((r) => r.client_id == null);
    expect(free, "свободный QR после generate").toBeTruthy();
    if (!free) return;

    const clientsRes = await request(app.server)
      .get("/api/test1/clients?page=1&limit=1&is_active=true")
      .set("Authorization", `Bearer ${token}`);
    expect(clientsRes.status).toBe(200);
    const clientId = (clientsRes.body.data[0] as { id: number }).id;

    const bind = await request(app.server)
      .post("/api/test1/client-qr-codes/bind")
      .set("Authorization", `Bearer ${token}`)
      .send({ qr_id: free.id, client_id: clientId });
    expect(bind.status).toBe(200);

    const unbind = await request(app.server)
      .post("/api/test1/client-qr-codes/unbind")
      .set("Authorization", `Bearer ${token}`)
      .send({ qr_id: free.id });
    expect(unbind.status).toBe(200);
  });

  it("POST mark-printed updates selected QR", async () => {
    const token = await adminToken();

    const list = await request(app.server)
      .get("/api/test1/client-qr-codes?page=1&limit=1")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const first = (list.body.data as Array<{ id: number }>)[0];
    if (!first) return;

    const res = await request(app.server)
      .post("/api/test1/client-qr-codes/mark-printed")
      .set("Authorization", `Bearer ${token}`)
      .send({ qr_ids: [first.id], qr_size_label: "10 × 10" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ updated: expect.any(Number) });
  });

  it("rejects mark-printed with empty qr_ids", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .post("/api/test1/client-qr-codes/mark-printed")
      .set("Authorization", `Bearer ${token}`)
      .send({ qr_ids: [] });

    expect(res.status).toBe(400);
  });
});
