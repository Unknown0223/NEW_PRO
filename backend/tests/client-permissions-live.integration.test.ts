/**
 * Доступ → Клиенты: har bir operatsiya jonli tekshiriladi (RBAC_ENFORCE_PERMISSIONS=1).
 * `operator` foydalanuvchisiga faqat bitta operatsiya beriladi, «Клиенты»ning qolgan hammasi taqiqlanadi:
 * berilganda endpoint ochiladi (403 emas), olinganda 403 ForbiddenPermission.
 * Yozish so'rovlari mavjud bo'lmagan ID / bo'sh tana bilan — ma'lumot o'zgarmaydi.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/config/database";
import { buildStructuredPermissionCatalog } from "../src/modules/access/permission-model";
import { loginForIntegrationTest } from "./test-auth.helpers";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const SLUG = "test1";
const NO_ID = 999_999_999;
const CLIENT_KEYS = buildStructuredPermissionCatalog()
  .filter((e) => e.module === "clients")
  .map((e) => e.key);

type Call = { method: "get" | "post" | "patch" | "delete"; path: string; body?: unknown };
type Case = { key: string; calls: (clientId: number) => Call[] };

const bulk = (patch: Record<string, unknown>): Call => ({
  method: "patch",
  path: "/clients/bulk",
  body: { client_ids: [NO_ID], patch }
});
const slotMerge = (slot: Record<string, unknown>) =>
  bulk({ agent_assignments: [{ slot: 1, ...slot }], agent_assignments_merge: true });

const CASES: Case[] = [
  { key: "clients.klient.view", calls: (id) => [{ method: "get", path: "/clients?page=1&limit=1" }, { method: "get", path: `/clients/${id}` }] },
  { key: "clients.klient.create", calls: () => [{ method: "post", path: "/clients", body: {} }] },
  { key: "clients.klient.update", calls: (id) => [{ method: "patch", path: `/clients/${id}`, body: {} }] },
  { key: "clients.klient.import", calls: () => [{ method: "post", path: "/clients/import", body: {} }] },
  { key: "clients.klient.copy", calls: () => [{ method: "get", path: "/clients/export?limit=1" }] },
  { key: "clients.klient.activate", calls: () => [{ method: "patch", path: "/clients/bulk-active", body: { client_ids: [NO_ID], is_active: true } }] },
  { key: "clients.klient.deactivate", calls: () => [{ method: "patch", path: "/clients/bulk-active", body: { client_ids: [NO_ID], is_active: false } }] },
  { key: "clients.klient.history", calls: (id) => [{ method: "get", path: `/clients/${id}/audit` }] },
  { key: "clients.gr_komanda.update", calls: () => [bulk({ agent_id: NO_ID }), bulk({ agent_assignments: [{ slot: 1 }] })] },
  { key: "clients.gr_territoriya.update", calls: () => [bulk({ region: "X", city: "Y" })] },
  { key: "clients.gr_kategoriya.update", calls: () => [bulk({ category: "X" })] },
  { key: "clients.gr_tip_format.update", calls: () => [bulk({ client_type_code: "X", client_format: "Y" })] },
  { key: "clients.gr_kanal.update", calls: () => [bulk({ sales_channel: "X" })] },
  { key: "clients.gr_sklad_kassa.update", calls: () => [bulk({ warehouse_id: NO_ID, cash_desk_id: NO_ID })] },
  { key: "clients.gr_dolg.update", calls: () => [bulk({ allow_order_with_debt: true, allow_consignment: true })] },
  { key: "clients.gr_kategoriya_tovara.update", calls: () => [bulk({ product_category_ref: "X" })] },
  { key: "clients.gr_kredit_limit.update", calls: () => [bulk({ credit_limit: 1 })] },
  { key: "clients.gr_tip_tseny.update", calls: () => [bulk({ price_type: "X" })] },
  { key: "clients.gr_tegi.update", calls: () => [{ method: "patch", path: "/clients/bulk-tags", body: { client_ids: [NO_ID], add_tag_ids: [NO_ID] } }] },
  { key: "clients.karta.view", calls: () => [{ method: "get", path: "/clients?page=1&limit=1&map=1" }] },
  { key: "clients.vizity.view", calls: () => [{ method: "get", path: "/clients?page=1&limit=1&map=1&visit_planner=1" }] },
  { key: "clients.vizity_agent.update", calls: () => [slotMerge({ agent_id: NO_ID })] },
  { key: "clients.vizity_dni.update", calls: () => [slotMerge({ visit_weekdays: [1, 3] })] },
  { key: "clients.vizity_ekspeditor.update", calls: () => [slotMerge({ expeditor_user_id: NO_ID })] },
  { key: "clients.vizity_sklad.update", calls: () => [bulk({ warehouse_id: NO_ID, zone: "Z" })] },
  { key: "clients.vizity_kassa.update", calls: () => [bulk({ cash_desk_id: NO_ID, zone: "Z" })] },
  { key: "clients.obedinenie.view", calls: () => [{ method: "post", path: "/clients/merge-preview", body: {} }, { method: "get", path: "/clients/saved-duplicate-groups" }] },
  { key: "clients.obedinenie.update", calls: () => [{ method: "post", path: "/clients/merge", body: {} }] },
  { key: "clients.obedinenie.create", calls: () => [{ method: "post", path: "/clients/saved-duplicate-groups", body: {} }] },
  { key: "clients.obedinenie.delete", calls: () => [{ method: "delete", path: `/clients/saved-duplicate-groups/${NO_ID}` }] },
  { key: "clients.obedinenie.restore", calls: () => [{ method: "post", path: `/clients/saved-duplicate-groups/${NO_ID}/restore`, body: {} }] },
  { key: "clients.obedinenie.history", calls: () => [{ method: "get", path: "/clients/merge-history" }] },
  { key: "clients.oborudovanie.view", calls: (id) => [{ method: "get", path: "/equipment" }, { method: "get", path: `/clients/${id}/equipment` }] },
  { key: "clients.oborudovanie.create", calls: (id) => [{ method: "post", path: `/clients/${id}/equipment`, body: {} }] },
  { key: "clients.oborudovanie.delete", calls: (id) => [{ method: "post", path: `/clients/${id}/equipment/${NO_ID}/remove`, body: {} }] },
  { key: "clients.foto.view", calls: (id) => [{ method: "get", path: `/clients/${id}/photo-reports` }] },
  { key: "clients.foto.create", calls: (id) => [{ method: "post", path: `/clients/${id}/photo-reports`, body: {} }] },
  { key: "clients.foto.void", calls: (id) => [{ method: "delete", path: `/clients/${id}/photo-reports/${NO_ID}` }] },
  { key: "clients.foto.restore", calls: (id) => [{ method: "post", path: `/clients/${id}/photo-reports/${NO_ID}/restore`, body: {} }] },
  { key: "clients.ostatki_tt.view", calls: () => [{ method: "get", path: "/retail-stock" }] },
  { key: "clients.ostatki_tt.import", calls: () => [{ method: "get", path: "/retail-stock/template" }] },
  { key: "clients.ostatki_tt.copy", calls: () => [{ method: "get", path: "/retail-stock/export" }] }
];

describe.skipIf(!dbReady)("Доступ → Клиенты: jonli berish / olish", () => {
  let app: FastifyInstance;
  let adminToken = "";
  let operatorId = 0;
  let clientId = 0;
  let tenantId = 0;
  let savedPerms: Array<{ permission_id: number; effect: string }> = [];

  beforeAll(async () => {
    process.env.RBAC_ENFORCE_PERMISSIONS = "1";
    vi.resetModules();
    const mod = await import("../src/app");
    app = mod.buildApp();
    await app.ready();

    const op = await prisma.user.findFirstOrThrow({ where: { tenant: { slug: SLUG }, login: "operator" }, select: { id: true } });
    operatorId = op.id;
    savedPerms = await prisma.userPermission.findMany({ where: { user_id: operatorId }, select: { permission_id: true, effect: true } });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SLUG }, select: { id: true } });
    tenantId = tenant.id;
    const c = await prisma.client.findFirstOrThrow({ where: { tenant_id: tenantId, is_active: true }, select: { id: true }, orderBy: { id: "asc" } });
    clientId = c.id;

    const admin = await loginForIntegrationTest(app, { slug: SLUG, login: "admin", password: "secret123" });
    adminToken = admin.body.accessToken as string;
  }, 120_000);

  afterAll(async () => {
    if (operatorId) {
      await prisma.userPermission.deleteMany({ where: { user_id: operatorId } });
      if (savedPerms.length) {
        await prisma.userPermission.createMany({ data: savedPerms.map((p) => ({ user_id: operatorId, ...p })) });
      }
    }
    await app?.close();
    process.env.RBAC_ENFORCE_PERMISSIONS = "0";
    vi.resetModules();
  });

  async function setOperatorKeys(allow: string[]) {
    const res = await request(app.server)
      .patch(`/api/${SLUG}/access/users/${operatorId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ merge_permissions: false, permissions: allow, denied_permissions: CLIENT_KEYS.filter((k) => !allow.includes(k)) });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }

  /** Operator рабочее местоga biriktirilmagan bo'lishi mumkin — login o'rniga token server kalitida imzolanadi. */
  async function operatorToken() {
    return app.jwt.sign(
      { sub: String(operatorId), tenantId, role: "operator", login: "operator", tenantSlug: SLUG },
      { expiresIn: "15m" }
    );
  }

  function send(token: string, call: Call) {
    const req = request(app.server)[call.method](`/api/${SLUG}${call.path}`).set("Authorization", `Bearer ${token}`);
    return call.body !== undefined ? req.send(call.body as object) : req;
  }

  it("katalogdagi har bir «Клиенты» operatsiyasi testda bor", () => {
    expect(CASES.map((c) => c.key).sort()).toEqual([...CLIENT_KEYS].sort());
  });

  for (const c of CASES) {
    it(`${c.key}: berilganda ochiq, olinganda 403`, async () => {
      const token = await operatorToken();
      await setOperatorKeys([c.key]);
      for (const call of c.calls(clientId)) {
        const res = await send(token, call);
        // «Forbidden» (hudud / агент зоны) — ruxsat kalitidan o'tgan, scope cheklovi.
        expect(res.body?.error, `${call.method.toUpperCase()} ${call.path} → ${JSON.stringify(res.body).slice(0, 300)}`).not.toBe("ForbiddenPermission");
      }
      await setOperatorKeys([]);
      for (const call of c.calls(clientId)) {
        const res = await send(token, call);
        expect(res.status, `${call.method.toUpperCase()} ${call.path} (olingan)`).toBe(403);
        expect(res.body.error).toBe("ForbiddenPermission");
      }
    });
  }

  it("xarita: faqat «Дни визитов» — kun o'zgaradi, agent va ekspeditor saqlanadi; agentni o'zgartirish 403", async () => {
    const row = await prisma.clientAgentAssignment.findFirst({
      where: { tenant_id: tenantId, slot: 1, agent_id: { not: null } },
      select: { client_id: true, agent_id: true, expeditor_user_id: true, visit_weekdays: true }
    });
    expect(row, "test1 da agent biriktirilgan mijoz kerak").toBeTruthy();
    if (!row) return;
    const otherSlots = await prisma.clientAgentAssignment.count({ where: { client_id: row.client_id } });
    const token = await operatorToken();
    await setOperatorKeys(["clients.vizity_dni.update"]);
    try {
      const days = Array.isArray(row.visit_weekdays) && (row.visit_weekdays as number[]).includes(6) ? [2, 4] : [6];
      const ok = await send(token, {
        method: "patch",
        path: "/clients/bulk",
        body: { client_ids: [row.client_id], patch: { agent_assignments: [{ slot: 1, visit_weekdays: days }], agent_assignments_merge: true } }
      });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.updated, JSON.stringify(ok.body)).toBe(1);
      const after = await prisma.clientAgentAssignment.findUniqueOrThrow({ where: { client_id_slot: { client_id: row.client_id, slot: 1 } } });
      expect(after.agent_id).toBe(row.agent_id);
      expect(after.expeditor_user_id).toBe(row.expeditor_user_id);
      expect(after.visit_weekdays).toEqual(days);
      expect(await prisma.clientAgentAssignment.count({ where: { client_id: row.client_id } })).toBe(otherSlots);

      const denied = await send(token, {
        method: "patch",
        path: "/clients/bulk",
        body: { client_ids: [row.client_id], patch: { agent_assignments: [{ slot: 1, agent_id: row.agent_id }], agent_assignments_merge: true } }
      });
      expect(denied.status).toBe(403);
      expect(denied.body.permissions).toEqual(["clients.vizity_agent.update"]);

      const replace = await send(token, {
        method: "patch",
        path: "/clients/bulk",
        body: { client_ids: [row.client_id], patch: { agent_assignments: [{ slot: 1, visit_weekdays: days }] } }
      });
      expect(replace.status).toBe(403);
    } finally {
      await prisma.clientAgentAssignment.update({
        where: { client_id_slot: { client_id: row.client_id, slot: 1 } },
        data: { visit_weekdays: (row.visit_weekdays ?? []) as Prisma.InputJsonValue }
      });
    }
  });
});
