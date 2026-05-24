import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { buildApp } from "../src/app";
import { applyDueProductPriceSchedules } from "../src/modules/products/product-price-schedules.service";
import { getProductPrice } from "../src/modules/products/product-prices.service";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const app = buildApp();

describe.skipIf(!dbReady)("product price schedules (database)", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("PATCH matrix with future effective_at schedules; applyDue updates product_prices", async () => {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    expect(loginResponse.status).toBe(200);
    const token = loginResponse.body.accessToken as string;

    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const cat = await prisma.productCategory.findFirst({
      where: { tenant_id: tenant!.id, name: "Ichimliklar" }
    });
    expect(cat).toBeTruthy();

    const product = await prisma.product.findFirst({
      where: { tenant_id: tenant!.id, sku: "SKU-001" }
    });
    expect(product).toBeTruthy();

    const priceType = `schedule-test-${Date.now()}`;
    const future = new Date(Date.now() + 3600_000);

    const patchRes = await request(app.server)
      .patch("/api/test1/products/prices/matrix")
      .set("Authorization", `Bearer ${token}`)
      .send({
        price_type: priceType,
        category_ids: [cat!.id],
        effective_at: future.toISOString(),
        items: [{ product_id: product!.id, price: 424242 }]
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.mode).toBe("scheduled");

    const beforeApply = await getProductPrice(tenant!.id, product!.id, priceType);
    expect(beforeApply).toBeNull();

    const pending = await prisma.productPriceSchedule.findFirst({
      where: {
        tenant_id: tenant!.id,
        product_id: product!.id,
        price_type: priceType,
        status: "pending"
      }
    });
    expect(pending).toBeTruthy();

    await prisma.productPriceSchedule.update({
      where: { id: pending!.id },
      data: { effective_at: new Date(Date.now() - 1000) }
    });

    const applied = await applyDueProductPriceSchedules();
    expect(applied.applied).toBeGreaterThanOrEqual(1);

    const after = await getProductPrice(tenant!.id, product!.id, priceType);
    expect(after).toBe("424242");
  });

  it("GET matrix accepts comma-separated category_ids", async () => {
    const loginResponse = await request(app.server).post("/api/auth/login").send({
      slug: "test1",
      login: "admin",
      password: "secret123"
    });
    const token = loginResponse.body.accessToken as string;

    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    const cats = await prisma.productCategory.findMany({
      where: { tenant_id: tenant!.id },
      take: 2,
      orderBy: { id: "asc" }
    });
    expect(cats.length).toBeGreaterThanOrEqual(2);

    const res = await request(app.server)
      .get(
        `/api/test1/products/prices/matrix?category_ids=${cats[0]!.id},${cats[1]!.id}&price_type=retail`
      )
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty("category_id");
      expect(res.body.data[0]).toHaveProperty("category_name");
    }
  });
});
