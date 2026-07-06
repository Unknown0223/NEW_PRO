import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../src/app";
import { loginForIntegrationTest } from "./test-auth.helpers";

const app = buildApp();

describe("mobile bonus-preview", () => {
  beforeAll(async () => {
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it("agent POST bonus-preview returns 200", async () => {
    const login = await loginForIntegrationTest(app, {
      slug: "test1",
      login: "agent",
      password: "111111"
    });
    expect(login.status).toBe(200);
    const token = login.body.accessToken as string;

    const sync = await request(app.server)
      .post("/api/test1/mobile/sync/full")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(sync.status).toBe(200);
    const clientId = sync.body.clients[0].id as number;

    const ctx = await request(app.server)
      .get(`/api/test1/mobile/orders/create-context?selected_client_id=${clientId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(ctx.status).toBe(200);

    const warehouseId = ctx.body.warehouses[0].id as number;
    const priceType = ctx.body.price_types[0] as string;
    const ichimlik = (ctx.body.products as { id: number; category_name?: string | null }[]).filter(
      (p) => (p.category_name ?? "").toLowerCase().includes("ichimlik")
    );
    const items =
      ichimlik.length >= 2
        ? [
            { product_id: ichimlik[0]!.id, qty: 5 },
            { product_id: ichimlik[1]!.id, qty: 5 }
          ]
        : [{ product_id: (ctx.body.products[0] as { id: number }).id, qty: 14 }];

    const preview = await request(app.server)
      .post("/api/test1/mobile/orders/bonus-preview")
      .set("Authorization", `Bearer ${token}`)
      .send({
        client_id: clientId,
        warehouse_id: warehouseId,
        price_type: priceType,
        items
      });

    if (preview.status !== 200) {
      // eslint-disable-next-line no-console
      console.error("bonus-preview failed", preview.status, preview.body);
    }
    expect(preview.status).toBe(200);
    expect(preview.body).toHaveProperty("eligible_bonuses");

    const sixOne = (preview.body.eligible_bonuses as { name?: string; bonus_qty?: number }[]).find(
      (b) => b.name === "6+1 aksiya"
    );
    if (sixOne) {
      expect(sixOne.bonus_qty).toBeGreaterThan(0);
    }
  });
});
