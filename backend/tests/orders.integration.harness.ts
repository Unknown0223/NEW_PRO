import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect } from "vitest";
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
