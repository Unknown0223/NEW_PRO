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

describe.skipIf(!dbReady)("work-slots API (database)", () => {
  beforeAll(async () => {
    await app.ready();
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    if (!tenant) return;
    const table = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'work_slots'
      ) AS exists
    `;
    if (!table[0]?.exists) {
      throw new Error("work_slots table missing — run prisma migrate deploy");
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  it("GET /work-slots returns list", async () => {
    const token = await adminToken();
    const res = await request(app.server)
      .get("/api/test1/work-slots")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
  });

  it("POST create → assign agent → history → unassign flow", async () => {
    const token = await adminToken();
    const code = `TST-${Date.now()}`.slice(0, 20);

    const createRes = await request(app.server)
      .post("/api/test1/work-slots")
      .set("Authorization", `Bearer ${token}`)
      .send({
        slot_code: code,
        label: "Integration test slot",
        slot_type: "agent"
      });
    expect(createRes.status).toBe(201);
    const slotId = createRes.body.data.id as number;
    expect(createRes.body.data.slot_code).toBe(code.toUpperCase());

    const agentLogin = `ws_agent_${Date.now()}`;
    const createAgent = await request(app.server)
      .post("/api/test1/agents")
      .set("Authorization", `Bearer ${token}`)
      .send({
        first_name: "WS",
        last_name: "Test",
        login: agentLogin,
        password: "secret12"
      });
    expect(createAgent.status).toBe(201);
    const agentId = createAgent.body.id as number;

    const assignRes = await request(app.server)
      .post(`/api/test1/work-slots/${slotId}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ user_id: agentId, note: "integration assign" });
    expect(assignRes.status).toBe(200);
    expect(assignRes.body.data.active_user_id).toBe(agentId);

    const checklistRes = await request(app.server)
      .get(`/api/test1/work-slots/${slotId}/checklist`)
      .set("Authorization", `Bearer ${token}`);
    expect(checklistRes.status).toBe(200);
    expect(checklistRes.body.data).toMatchObject({
      slot_has_active_user: true,
      active_user_id: agentId
    });

    const historyRes = await request(app.server)
      .get(`/api/test1/work-slots/${slotId}/history`)
      .set("Authorization", `Bearer ${token}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(historyRes.body.data[0].action).toMatch(/assign|swap/);

    const detailBefore = await request(app.server)
      .get(`/api/test1/work-slots/${slotId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detailBefore.body.data.active_user_name).toBeTruthy();

    const unassignRes = await request(app.server)
      .post(`/api/test1/work-slots/${slotId}/unassign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: "integration unassign" });
    expect(unassignRes.status).toBe(200);
    expect(unassignRes.body.data.active_user_id).toBeNull();

    const historyAfter = await request(app.server)
      .get(`/api/test1/work-slots/${slotId}/history`)
      .set("Authorization", `Bearer ${token}`);
    expect(historyAfter.body.data.some((h: { action: string }) => h.action === "unassign")).toBe(true);
  });

  it("POST duplicate slot_code returns CodeTaken", async () => {
    const token = await adminToken();
    const code = `DUP-${Date.now()}`.slice(0, 16);
    const first = await request(app.server)
      .post("/api/test1/work-slots")
      .set("Authorization", `Bearer ${token}`)
      .send({ slot_code: code, slot_type: "agent" });
    expect(first.status).toBe(201);

    const second = await request(app.server)
      .post("/api/test1/work-slots")
      .set("Authorization", `Bearer ${token}`)
      .send({ slot_code: code, slot_type: "agent" });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("CodeTaken");
  });

  it("assign rejects wrong role for slot type", async () => {
    const token = await adminToken();
    const code = `ROLE-${Date.now()}`.slice(0, 16);
    const slot = await request(app.server)
      .post("/api/test1/work-slots")
      .set("Authorization", `Bearer ${token}`)
      .send({ slot_code: code, slot_type: "agent" });
    const slotId = slot.body.data.id as number;

    const expLogin = `ws_exp_${Date.now()}`;
    const createExp = await request(app.server)
      .post("/api/test1/expeditors")
      .set("Authorization", `Bearer ${token}`)
      .send({
        first_name: "Exp",
        last_name: "WS",
        login: expLogin,
        password: "secret12"
      });
    expect(createExp.status).toBe(201);

    const badAssign = await request(app.server)
      .post(`/api/test1/work-slots/${slotId}/assign`)
      .set("Authorization", `Bearer ${token}`)
      .send({ user_id: createExp.body.id });
    expect(badAssign.status).toBe(400);
    expect(badAssign.body.error).toBe("ValidationError");
  });

  it("client assignment lock contract + pending resolve", async () => {
    const token = await adminToken();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });

    const client = await prisma.client.findFirst({
      where: { tenant_id: tenant.id, merged_into_client_id: null, is_active: true },
      select: { id: true }
    });
    expect(client).toBeTruthy();

    let assignment = await prisma.clientAgentAssignment.findFirst({
      where: { tenant_id: tenant.id, client_id: client!.id, slot: 1 }
    });
    if (!assignment) {
      assignment = await prisma.clientAgentAssignment.create({
        data: {
          tenant_id: tenant.id,
          client_id: client!.id,
          slot: 1,
          lock_type: "none",
          auto_assign_status: "assigned"
        }
      });
    }

    const lockRes = await request(app.server)
      .patch(`/api/test1/client-agent-assignments/${assignment.id}/lock`)
      .set("Authorization", `Bearer ${token}`)
      .send({ lock_type: "contract", lock_reason: "Test shartnoma" });
    expect(lockRes.status).toBe(200);
    expect(lockRes.body.data.lock_type).toBe("contract");

    await prisma.clientAgentAssignment.update({
      where: { id: assignment.id },
      data: { auto_assign_status: "pending_review", agent_id: null }
    });

    const pendingRes = await request(app.server)
      .get("/api/test1/client-agent-assignments/pending")
      .set("Authorization", `Bearer ${token}`);
    expect(pendingRes.status).toBe(200);
    expect(pendingRes.body.data.some((r: { id: number }) => r.id === assignment!.id)).toBe(true);

    const pendingCount = await request(app.server)
      .get("/api/test1/work-slots/pending-count")
      .set("Authorization", `Bearer ${token}`);
    expect(pendingCount.status).toBe(200);
    expect(pendingCount.body.count).toBeGreaterThanOrEqual(1);

    const agentUser = await prisma.user.findFirst({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      select: { id: true }
    });
    expect(agentUser).toBeTruthy();

    const resolveRes = await request(app.server)
      .post(`/api/test1/client-agent-assignments/${assignment.id}/resolve`)
      .set("Authorization", `Bearer ${token}`)
      .send({ agent_id: agentUser!.id, lock_after: false });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.auto_assign_status).toBe("assigned");
    expect(resolveRes.body.data.agent_id).toBe(agentUser!.id);

    await prisma.clientAgentAssignment.update({
      where: { id: assignment.id },
      data: { lock_type: "none", lock_reason: null, lock_set_by: null }
    });
  });

  it("POST order returns ContractAgentMismatch when slot1 is contract-locked to another agent", async () => {
    const token = await adminToken();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });

    const agents = await prisma.user.findMany({
      where: { tenant_id: tenant.id, role: "agent", is_active: true },
      take: 2,
      orderBy: { id: "asc" },
      select: { id: true }
    });
    expect(agents.length).toBeGreaterThanOrEqual(2);
    const lockedAgentId = agents[0]!.id;
    const wrongAgentId = agents[1]!.id;

    const assignment = await prisma.clientAgentAssignment.findFirst({
      where: { tenant_id: tenant.id, slot: 1 },
      select: {
        id: true,
        client_id: true,
        agent_id: true,
        lock_type: true,
        lock_reason: true,
        lock_set_by: true
      }
    });
    expect(assignment).toBeTruthy();

    await prisma.clientAgentAssignment.update({
      where: { id: assignment!.id },
      data: {
        agent_id: lockedAgentId,
        lock_type: "contract",
        lock_reason: "integration contract lock",
        lock_set_by: null
      }
    });
    await prisma.client.update({
      where: { id: assignment!.client_id },
      data: { agent_id: lockedAgentId }
    });

    const productsRes = await request(app.server)
      .get("/api/test1/products?page=1&limit=5&search=SKU-001")
      .set("Authorization", `Bearer ${token}`);
    expect(productsRes.status).toBe(200);
    const productId = productsRes.body.data[0].id as number;

    const warehouse = await prisma.warehouse.findFirst({
      where: { tenant_id: tenant.id },
      select: { id: true }
    });
    expect(warehouse).toBeTruthy();

    const create = await request(app.server)
      .post("/api/test1/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        agent_id: wrongAgentId,
        client_id: assignment!.client_id,
        warehouse_id: warehouse!.id,
        items: [{ product_id: productId, qty: 1 }]
      });
    expect(create.status).toBe(409);
    expect(create.body.error).toBe("ContractAgentMismatch");

    await prisma.clientAgentAssignment.update({
      where: { id: assignment!.id },
      data: {
        agent_id: assignment!.agent_id,
        lock_type: assignment!.lock_type ?? "none",
        lock_reason: assignment!.lock_reason,
        lock_set_by: assignment!.lock_set_by
      }
    });
    if (assignment!.agent_id != null) {
      await prisma.client.update({
        where: { id: assignment!.client_id },
        data: { agent_id: assignment!.agent_id }
      });
    }
  });

  it("lock without reason returns LockReasonRequired", async () => {
    const token = await adminToken();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "test1" } });
    const assignment = await prisma.clientAgentAssignment.findFirst({
      where: { tenant_id: tenant.id },
      select: { id: true }
    });
    expect(assignment).toBeTruthy();

    const res = await request(app.server)
      .patch(`/api/test1/client-agent-assignments/${assignment!.id}/lock`)
      .set("Authorization", `Bearer ${token}`)
      .send({ lock_type: "contract", lock_reason: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("LockReasonRequired");
  });
});
