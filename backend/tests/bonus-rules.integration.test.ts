import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { prisma } from "../src/config/database";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

describe.skipIf(!dbReady)("bonus-rules API (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  async function adminToken(): Promise<string> {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    return loginResponse.body.accessToken as string;
  }

  it("returns bonus rules list for tenant after login", async () => {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });

    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    const listResponse = await request(app.server)
      .get("/api/test1/bonus-rules")
      .set("Authorization", `Bearer ${token}`);

    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body.data)).toBe(true);
    expect(typeof listResponse.body.total).toBe("number");
  });

  it("preview-qty: seed 6+1 in_blocks → 12 sotib olinganda 2 bonus", async () => {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    const listResponse = await request(app.server)
      .get("/api/test1/bonus-rules")
      .set("Authorization", `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    const sixOne = (listResponse.body.data as { id: number; name: string }[]).find(
      (r) => r.name === "6+1 aksiya"
    );
    expect(sixOne).toBeDefined();

    const preview = await request(app.server)
      .post(`/api/test1/bonus-rules/${sixOne!.id}/preview-qty`)
      .set("Authorization", `Bearer ${token}`)
      .send({ purchased_qty: 12 });

    expect(preview.status).toBe(200);
    expect(preview.body.bonus_qty).toBe(2);
    expect(preview.body.matched).toBe(true);
    expect(preview.body.in_blocks).toBe(true);
  });

  describe.sequential("create/read/update discount & bonus scopes", () => {
    it("POST inactive manual discount → GET → DELETE", async () => {
      const token = await adminToken();
      const name = `IT-discount-${Date.now()}`;
      const post = await request(app.server)
        .post("/api/test1/bonus-rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name,
          type: "discount",
          discount_pct: 8,
          is_manual: true,
          is_active: false,
          priority: -9_000_000
        });
      expect(post.status).toBe(201);
      expect(post.body.type).toBe("discount");
      expect(Number(post.body.discount_pct)).toBe(8);
      expect(post.body.sum_threshold_scope).toBe("order");

      const get = await request(app.server)
        .get(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(get.status).toBe(200);
      expect(get.body.name).toBe(name);

      const del = await request(app.server)
        .delete(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(del.status).toBe(200);
    });

    it("POST qty with sum_threshold_scope calendar_month → PUT order → DELETE", async () => {
      const token = await adminToken();
      const name = `IT-qty-month-${Date.now()}`;
      const post = await request(app.server)
        .post("/api/test1/bonus-rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name,
          type: "qty",
          is_manual: true,
          is_active: false,
          priority: -9_000_001,
          sum_threshold_scope: "calendar_month",
          in_blocks: true,
          conditions: [{ step_qty: 6, bonus_qty: 1, sort_order: 0 }]
        });
      expect(post.status).toBe(201);
      expect(post.body.sum_threshold_scope).toBe("calendar_month");

      const put = await request(app.server)
        .put(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ sum_threshold_scope: "order" });
      expect(put.status).toBe(200);
      expect(put.body.sum_threshold_scope).toBe("order");

      const del = await request(app.server)
        .delete(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(del.status).toBe(200);
    });

    it("POST sum gift with calendar_month scope → GET → DELETE", async () => {
      const token = await adminToken();
      const name = `IT-sum-month-${Date.now()}`;
      const post = await request(app.server)
        .post("/api/test1/bonus-rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name,
          type: "sum",
          min_sum: 9_999_999,
          free_qty: 1,
          sum_threshold_scope: "calendar_month",
          is_manual: true,
          is_active: false,
          priority: -9_000_002
        });
      expect(post.status).toBe(201);
      expect(post.body.type).toBe("sum");
      expect(post.body.sum_threshold_scope).toBe("calendar_month");
      expect(Number(post.body.min_sum)).toBe(9_999_999);

      const del = await request(app.server)
        .delete(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(del.status).toBe(200);
    });

    it("POST qty with UI flags → GET preserves scope, manual, blocks, once_per_client", async () => {
      const token = await adminToken();
      const products = await request(app.server)
        .get("/api/test1/products?limit=1&is_active=true")
        .set("Authorization", `Bearer ${token}`);
      expect(products.status).toBe(200);
      const productId = (products.body.data as { id: number }[])[0]?.id;
      expect(productId).toBeGreaterThan(0);

      const name = `IT-qty-flags-${Date.now()}`;
      const post = await request(app.server)
        .post("/api/test1/bonus-rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name,
          type: "qty",
          is_manual: false,
          is_active: true,
          in_blocks: true,
          once_per_client: true,
          target_all_clients: true,
          scope_restrict_assortment: true,
          scope_restrict_category: false,
          product_ids: [productId],
          priority: -9_000_003,
          conditions: [{ step_qty: 6, bonus_qty: 1, sort_order: 0 }]
        });
      expect(post.status).toBe(201);
      expect(post.body.scope_restrict_assortment).toBe(true);
      expect(post.body.scope_restrict_category).toBe(false);
      expect(post.body.in_blocks).toBe(true);
      expect(post.body.once_per_client).toBe(true);
      expect(post.body.is_manual).toBe(false);
      expect(post.body.product_ids).toEqual([productId]);

      const get = await request(app.server)
        .get(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(get.status).toBe(200);
      expect(get.body.scope_restrict_assortment).toBe(true);
      expect(get.body.in_blocks).toBe(true);
      expect(get.body.once_per_client).toBe(true);
      expect(get.body.product_ids).toEqual([productId]);

      const put = await request(app.server)
        .put(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({
          in_blocks: false,
          once_per_client: false,
          scope_restrict_assortment: true,
          scope_restrict_category: false,
          product_ids: [productId],
          is_manual: false,
          target_all_clients: true,
          type: "qty",
          conditions: [{ step_qty: 6, bonus_qty: 1, sort_order: 0 }]
        });
      expect(put.status).toBe(200);
      expect(put.body.in_blocks).toBe(false);
      expect(put.body.once_per_client).toBe(false);

      const get2 = await request(app.server)
        .get(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(get2.body.in_blocks).toBe(false);
      expect(get2.body.once_per_client).toBe(false);

      const del = await request(app.server)
        .delete(`/api/test1/bonus-rules/${post.body.id}`)
        .set("Authorization", `Bearer ${token}`);
      expect(del.status).toBe(200);
    });

    it("locked rule: only valid_to and is_active; valid_from and name rejected", async () => {
      const token = await adminToken();
      const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
      expect(tenant).not.toBeNull();

      const products = await request(app.server)
        .get("/api/test1/products?limit=1&is_active=true")
        .set("Authorization", `Bearer ${token}`);
      const productId = (products.body.data as { id: number }[])[0]?.id;
      expect(productId).toBeGreaterThan(0);

      const name = `IT-locked-${Date.now()}`;
      const post = await request(app.server)
        .post("/api/test1/bonus-rules")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name,
          type: "qty",
          is_manual: false,
          is_active: true,
          scope_restrict_assortment: true,
          product_ids: [productId],
          priority: -9_000_004,
          valid_to: "2030-12-31T12:00:00.000Z",
          conditions: [{ step_qty: 6, bonus_qty: 1, sort_order: 0 }]
        });
      expect(post.status).toBe(201);
      const ruleId = post.body.id as number;

      const order = await prisma.order.findFirst({
        where: { tenant_id: tenant!.id },
        select: { id: true, applied_auto_bonus_rule_ids: true }
      });
      expect(order).not.toBeNull();
      const prevIds = [...order!.applied_auto_bonus_rule_ids];
      await prisma.order.update({
        where: { id: order!.id },
        data: { applied_auto_bonus_rule_ids: [...new Set([...prevIds, ruleId])] }
      });

      try {
        const get = await request(app.server)
          .get(`/api/test1/bonus-rules/${ruleId}`)
          .set("Authorization", `Bearer ${token}`);
        expect(get.status).toBe(200);
        expect(get.body.has_been_used).toBe(true);

        const rejectName = await request(app.server)
          .put(`/api/test1/bonus-rules/${ruleId}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ name: `${name}-changed` });
        expect(rejectName.status).toBe(409);
        expect(rejectName.body.error).toBe("RuleLocked");

        const rejectFrom = await request(app.server)
          .put(`/api/test1/bonus-rules/${ruleId}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ valid_from: "2020-01-01T00:00:00.000Z" });
        expect(rejectFrom.status).toBe(409);

        const ok = await request(app.server)
          .put(`/api/test1/bonus-rules/${ruleId}`)
          .set("Authorization", `Bearer ${token}`)
          .send({
            is_active: false,
            valid_to: "2035-06-30T23:59:00.000Z"
          });
        expect(ok.status).toBe(200);
        expect(ok.body.is_active).toBe(false);
        expect(ok.body.valid_to).toContain("2035-06-30");

        const scopeOk = await request(app.server)
          .patch(`/api/test1/bonus-rules/${ruleId}/order-scope`)
          .set("Authorization", `Bearer ${token}`)
          .send({ scope_agent_user_ids: [1] });
        expect(scopeOk.status).toBe(200);
        expect(scopeOk.body.scope_agent_user_ids).toContain(1);
      } finally {
        await prisma.order.update({
          where: { id: order!.id },
          data: { applied_auto_bonus_rule_ids: prevIds }
        });
        await request(app.server)
          .delete(`/api/test1/bonus-rules/${ruleId}`)
          .set("Authorization", `Bearer ${token}`);
      }
    });
  });
});
