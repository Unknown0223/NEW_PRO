import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { prisma } from "../src/config/database";

const marker = join(__dirname, ".db-integration-ready");
export const ordersDbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

export type OrdersIntegrationCtx = {
  app: FastifyInstance;
  get seedAgentUserId(): number;
};

/** Seed zaxirasi `type: main` omborda — `name` bo‘yicha birinchi qator har doim shu bo‘lmasligi mumkin */
export async function mainWarehouseId(app: FastifyInstance, token: string): Promise<number> {
  const list = await request(app.server).get("/api/test1/warehouses").set("Authorization", `Bearer ${token}`);
  expect(list.status).toBe(200);
  const rows = list.body.data as { id: number; name: string; type: string | null }[];
  expect(rows.length).toBeGreaterThan(0);
  const main = rows.find((w) => w.type === "main") ?? rows.find((w) => /asosiy/i.test(w.name)) ?? rows[0];
  return main.id;
}

/** Seed qty=100 yetmaydi; ba'zi testlar orderni to‘g‘ridan-to‘g‘ri o‘chiradi va reserved_qty “osib” qoladi. */
export async function ensureOrdersIntegrationStock(): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
  if (!tenant) return;
  const mainWh =
    (await prisma.warehouse.findFirst({ where: { tenant_id: tenant.id, type: "main" } })) ??
    (await prisma.warehouse.findFirst({
      where: { tenant_id: tenant.id, name: { contains: "Asosiy", mode: "insensitive" } }
    }));
  if (!mainWh) return;
  const products = await prisma.product.findMany({
    where: { tenant_id: tenant.id, sku: { in: ["SKU-001", "SKU-002", "SKU-003"] } }
  });
  const plenty = new Prisma.Decimal("1000000");
  const zero = new Prisma.Decimal("0");
  const sku2 = products.find((p) => p.sku === "SKU-002");
  const sku3 = products.find((p) => p.sku === "SKU-003");
  const sku1 = products.find((p) => p.sku === "SKU-001");
  if (sku2) {
    await prisma.bonusRule.updateMany({
      where: { tenant_id: tenant.id, name: "[seed] Chegirma 10%" },
      data: { once_per_client: false, product_ids: [sku2.id] }
    });
  }
  if (sku3) {
    await prisma.bonusRule.updateMany({
      where: { tenant_id: tenant.id, name: "[seed] Min summa 500 000" },
      data: {
        discount_pct: null,
        bonus_product_ids: [sku3.id],
        free_qty: 1,
        product_category_ids: sku1?.category_id ? [sku1.category_id] : []
      }
    });
  }
  await prisma.bonusRule.updateMany({
    where: {
      tenant_id: tenant.id,
      name: "[seed] Oraliq 10–30 dona (qadam + cheklov)"
    },
    data: { is_active: false }
  });
  const group =
    (await prisma.interchangeableProductGroup.findFirst({
      where: { tenant_id: tenant.id, name: "Seed — qaytarish guruhi" }
    })) ??
    (await prisma.interchangeableProductGroup.create({
      data: { tenant_id: tenant.id, name: "Seed — qaytarish guruhi", is_active: true }
    }));
  await prisma.interchangeableProductGroup.update({
    where: { id: group.id },
    data: { is_active: true }
  });
  for (const p of products) {
    await prisma.interchangeableGroupProduct.upsert({
      where: { group_id_product_id: { group_id: group.id, product_id: p.id } },
      create: { group_id: group.id, product_id: p.id },
      update: {}
    });
  }
  const activeGroups = await prisma.interchangeableProductGroup.findMany({
    where: { tenant_id: tenant.id, is_active: true },
    select: { id: true }
  });
  for (const g of activeGroups) {
    await prisma.interchangeableGroupPriceType.deleteMany({ where: { group_id: g.id } });
  }
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        return_filter: {
          period_enabled: false,
          period_unit: "day",
          period_value: 30,
          balance_zero_enabled: false
        },
        bonus_stack: { mode: "all", max_units: null, forbid_apply_all_eligible: false }
      } as object
    }
  });
  for (const p of products) {
    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: tenant.id,
          warehouse_id: mainWh.id,
          product_id: p.id
        }
      },
      create: {
        tenant_id: tenant.id,
        warehouse_id: mainWh.id,
        product_id: p.id,
        qty: plenty,
        reserved_qty: zero
      },
      update: { qty: plenty, reserved_qty: zero }
    });
  }
}

/**
 * Bir xil ombor/zaxira — parallel `it` bir-birini buzadi (InsufficientStock).
 * Har bir `orders.integration.*.test.ts` o‘z sequential blokida ishlaydi.
 */
export function describeOrdersIntegrationSuite(
  blockTitle: string,
  register: (ctx: OrdersIntegrationCtx) => void
): void {
  describe.skipIf(!ordersDbReady)(`orders API (database) — ${blockTitle}`, () => {
    describe.sequential(blockTitle, () => {
      const app = buildApp();
      let seedAgentUserId!: number;

      beforeAll(async () => {
        await app.ready();
        await ensureOrdersIntegrationStock();
        const t = await prisma.tenant.findUnique({ where: { slug: "test1" } });
        expect(t).toBeTruthy();
        const agent = await prisma.user.findFirst({
          where: { tenant_id: t!.id, login: "agent", role: "agent", is_active: true }
        });
        expect(agent).toBeTruthy();
        seedAgentUserId = agent!.id;
      });

      beforeEach(async () => {
        await ensureOrdersIntegrationStock();
      });

      afterAll(async () => {
        await app.close();
      });

      register({
        app,
        get seedAgentUserId() {
          return seedAgentUserId;
        }
      });
    });
  });
}
