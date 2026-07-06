/**
 * Dostup CRUD: markazlashgan route-permission-guard (RBAC_ENFORCE_PERMISSIONS=1).
 * Migratsiya + seed dan keyin agent orders ko‘ra oladi, sklad qoldiqlari — yo‘q.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { prisma } from "../src/config/database";
import { loginForIntegrationTest } from "./test-auth.helpers";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("RBAC enforcement (route-permission-guard)", () => {
  let app: FastifyInstance;
  let agentUserId: number;

  beforeAll(async () => {
    process.env.RBAC_ENFORCE_PERMISSIONS = "1";
    vi.resetModules();

    execSync("npx tsx scripts/migrate-permissions-to-crud.ts test1", {
      cwd: join(__dirname, ".."),
      stdio: "pipe",
      env: { ...process.env, RBAC_ENFORCE_PERMISSIONS: "1" }
    });

    const agentRow = await prisma.user.findFirst({
      where: { tenant: { slug: "test1" }, login: "agent" },
      select: { id: true }
    });
    expect(agentRow?.id).toBeDefined();
    agentUserId = agentRow!.id;

    const mod = await import("../src/app");
    app = mod.buildApp();
    await app.ready();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    process.env.RBAC_ENFORCE_PERMISSIONS = "0";
    vi.resetModules();
  });

  async function agentToken(): Promise<string> {
    const login = await loginForIntegrationTest(app, {
      slug: "test1",
      login: "agent",
      password: "111111"
    });
    expect(login.status).toBe(200);
    return login.body.accessToken as string;
  }

  it("admin GET /orders — chetlab o‘tadi (200)", async () => {
    const login = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    const token = login.body.accessToken as string;
    const res = await request(app.server)
      .get("/api/test1/orders?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("agent GET /orders — orders.zakaz.view (200)", async () => {
    const token = await agentToken();
    const res = await request(app.server)
      .get("/api/test1/orders?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  it("agent GET /stock/balances — ruxsat yo‘q (403 ForbiddenPermission)", async () => {
    const token = await agentToken();
    const res = await request(app.server)
      .get("/api/test1/stock/balances?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("ForbiddenPermission");
    expect(res.body.permissions).toEqual(expect.arrayContaining(["warehouse.ostatki.view"]));
  });

  it("agent user deny orders.zakaz.view — GET /orders 403", async () => {
    const adminLogin = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    const adminToken = adminLogin.body.accessToken as string;

    const deny = await request(app.server)
      .patch(`/api/test1/access/users/${agentUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        merge_permissions: true,
        denied_permissions: ["orders.zakaz.view"]
      });
    expect(deny.status).toBe(200);

    const token = await agentToken();
    const res = await request(app.server)
      .get("/api/test1/orders?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("ForbiddenPermission");

    const clear = await request(app.server)
      .patch(`/api/test1/access/users/${agentUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ remove_permission_keys: ["orders.zakaz.view"] });
    expect(clear.status).toBe(200);
  });
});
