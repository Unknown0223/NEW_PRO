import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();
const prisma = new PrismaClient();

async function adminToken(): Promise<string> {
  const loginResponse = await request(app.server).post("/api/auth/login").send({
    slug: "test1",
    login: "admin",
    password: "secret123"
  });
  expect(loginResponse.status).toBe(200);
  return loginResponse.body.accessToken as string;
}

describe.skipIf(!dbReady)("plans approvers API (database)", () => {
  let directionId: number;
  let supervisorId: number;
  let employeeId: number;

  beforeAll(async () => {
    await app.ready();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });

    const table = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'plan_approver_configs'
      ) AS exists
    `;
    if (!table[0]?.exists) {
      throw new Error("plan_approver_configs missing — run prisma migrate deploy");
    }

    let direction = await prisma.tradeDirection.findFirst({
      where: { tenant_id: tenant.id, is_active: true },
      select: { id: true }
    });
    if (!direction) {
      direction = await prisma.tradeDirection.create({
        data: {
          tenant_id: tenant.id,
          name: "Test Direction",
          code: `TD-${Date.now()}`.slice(0, 12),
          is_active: true,
          sort_order: 0
        },
        select: { id: true }
      });
    }
    directionId = direction.id;

    const supervisor = await prisma.user.findFirstOrThrow({
      where: { tenant_id: tenant.id, role: "supervisor", is_active: true },
      select: { id: true }
    });
    supervisorId = supervisor.id;

    const employee = await prisma.user.findFirstOrThrow({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      select: { id: true }
    });
    employeeId = employee.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("GET options returns directions and supervisors", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .get(`/api/test1/plans/approvers/options?direction_id=${directionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.directions)).toBe(true);
    expect(res.body.data.directions.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.supervisors)).toBe(true);
  });

  it("PUT then GET persists approval chain (replace)", async () => {
    const token = await adminToken();
    const leaderId = employeeId;

    const put = await request(app.server)
      .put(`/api/test1/plans/approvers?direction_id=${directionId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        rows: [{ supervisor_user_id: supervisorId, levels: [employeeId, null] }],
        leaders: [leaderId]
      });
    expect(put.status).toBe(200);
    expect(put.body.data.rows).toHaveLength(1);
    expect(put.body.data.rows[0].levels[0]).toBe(employeeId);
    expect(put.body.data.leaders).toContain(leaderId);

    const get = await request(app.server)
      .get(`/api/test1/plans/approvers?direction_id=${directionId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.data.rows[0].supervisor_user_id).toBe(supervisorId);
    expect(get.body.data.rows[0].levels[0]).toBe(employeeId);
    expect(get.body.data.leaders).toContain(leaderId);
  });

  it("PUT rejects invalid direction_id", async () => {
    const token = await adminToken();
    const bad = await request(app.server)
      .put(`/api/test1/plans/approvers?direction_id=999999`)
      .set("Authorization", `Bearer ${token}`)
      .send({ rows: [], leaders: [] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("ValidationError");
  });
});
