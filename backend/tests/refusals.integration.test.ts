import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

async function loginAdmin() {
  const res = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

describe.skipIf(!dbReady)("refusals API (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET filter-options returns agents and reasons", async () => {
    const token = await loginAdmin();
    const res = await request(app.server)
      .get("/api/test1/refusals/filter-options")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.agents)).toBe(true);
    expect(Array.isArray(res.body.data.reasons)).toBe(true);
  });

  it("GET list returns paginated refusals", async () => {
    const token = await loginAdmin();
    const res = await request(app.server)
      .get("/api/test1/refusals?page=1&limit=20&sort_by=created_at&sort_dir=desc")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(Array.isArray(res.body.stats_by_reason)).toBe(true);
  });

  it("GET with export_limit returns up to cap rows", async () => {
    const token = await loginAdmin();
    const res = await request(app.server)
      .get("/api/test1/refusals?export_limit=100")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBeLessThanOrEqual(100);
    expect(res.body.data.length).toBeLessThanOrEqual(100);
  });

  it("POST creates refusal for admin with agent_id", async () => {
    const token = await loginAdmin();

    const opts = await request(app.server)
      .get("/api/test1/refusals/filter-options")
      .set("Authorization", `Bearer ${token}`);
    const agentId = opts.body.data.agents[0]?.id as number | undefined;
    const reason = opts.body.data.reasons[0]?.value as string | undefined;
    expect(agentId).toBeTruthy();
    expect(reason).toBeTruthy();

    const clientList = await request(app.server)
      .get("/api/test1/clients?limit=1")
      .set("Authorization", `Bearer ${token}`);
    const clientId = clientList.body.data[0]?.id as number | undefined;
    expect(clientId).toBeTruthy();

    const create = await request(app.server)
      .post("/api/test1/refusals")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: clientId,
        agent_id: agentId,
        refusal_reason_ref: reason,
        comment: "integration test"
      });

    expect(create.status).toBe(201);
    expect(create.body.data.client_id).toBe(clientId);
    expect(create.body.data.refusal_reason_ref).toBe(reason);
  });
});
