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

describe.skipIf(!dbReady)("access / RBAC API (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/:slug/access/me-permissions returns keys", async () => {
    const token = await adminToken();
    const res = await request(app.server).get("/api/test1/access/me-permissions").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ keys: expect.any(Array) });
  });

  it("GET /api/:slug/access/users includes scope.territories", async () => {
    const token = await adminToken();
    const res = await request(app.server).get("/api/test1/access/users").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0].scope).toMatchObject({
        territories: expect.any(Array)
      });
    }
  });

  it("GET /api/:slug/access/users/:id/detail returns matrix and scope", async () => {
    const token = await adminToken();
    const list = await request(app.server).get("/api/test1/access/users").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    const id = list.body.data[0]?.id as number | undefined;
    expect(id).toBeDefined();
    const res = await request(app.server).get(`/api/test1/access/users/${id}/detail`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      user: expect.objectContaining({ id: expect.any(Number), login: expect.any(String) }),
      matrix: expect.any(Array),
      supervisees: expect.any(Array),
      scope: expect.objectContaining({
        branches: expect.any(Array),
        warehouses: expect.any(Array),
        cash_desks: expect.any(Array),
        payment_methods: expect.any(Array),
        territories: expect.any(Array)
      })
    });
  });

  it("GET /api/:slug/access/permissions/catalog returns modules and flat", async () => {
    const token = await adminToken();
    const res = await request(app.server).get("/api/test1/access/permissions/catalog").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.modules)).toBe(true);
    expect(Array.isArray(res.body.data.flat)).toBe(true);
    // DEFAULT_PERMISSION_METADATA + LEGACY_PERMISSION_METADATA (see permission-catalog.service sync)
    expect(res.body.data.flat.length).toBeGreaterThanOrEqual(340);
  });

  it("PATCH /api/:slug/access/users/:id accepts remove_permission_keys", async () => {
    const token = await adminToken();
    const list = await request(app.server).get("/api/test1/access/users").set("Authorization", `Bearer ${token}`);
    const id = list.body.data[0]?.id as number;
    expect(id).toBeDefined();
    const res = await request(app.server)
      .patch(`/api/test1/access/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ remove_permission_keys: ["__nonexistent_permission_key_zz__"] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it("PATCH remove_permission_keys clears user override after merge_permissions", async () => {
    const token = await adminToken();
    const cat = await request(app.server).get("/api/test1/access/permissions/catalog").set("Authorization", `Bearer ${token}`);
    expect(cat.status).toBe(200);
    const flat = cat.body.data.flat as { key: string }[];
    const key = flat.find((x) => typeof x.key === "string" && x.key.length > 0)?.key;
    expect(key).toBeDefined();

    const list = await request(app.server).get("/api/test1/access/users").set("Authorization", `Bearer ${token}`);
    const id = list.body.data[0]?.id as number;
    expect(id).toBeDefined();

    const merge = await request(app.server)
      .patch(`/api/test1/access/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ merge_permissions: true, permissions: [key] });
    expect(merge.status).toBe(200);

    const d1 = await request(app.server).get(`/api/test1/access/users/${id}/detail`).set("Authorization", `Bearer ${token}`);
    expect(d1.status).toBe(200);
    const row1 = (d1.body.data.matrix as { key: string; user_effect: string }[]).find((r) => r.key === key);
    expect(row1?.user_effect).toBe("allow");

    const rem = await request(app.server)
      .patch(`/api/test1/access/users/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ remove_permission_keys: [key] });
    expect(rem.status).toBe(200);

    const d2 = await request(app.server).get(`/api/test1/access/users/${id}/detail`).set("Authorization", `Bearer ${token}`);
    expect(d2.status).toBe(200);
    const row2 = (d2.body.data.matrix as { key: string; user_effect: string }[]).find((r) => r.key === key);
    expect(row2?.user_effect).toBe("none");
  });
});
