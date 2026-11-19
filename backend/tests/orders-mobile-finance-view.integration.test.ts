import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { applyDelta } from "../src/modules/client-balances/client-balance-mutator";
import { loadClientBalanceView } from "../src/modules/client-balances/client-balance-view";
import { getMobileOrderClientFinance } from "../src/modules/mobile/mobile-order-client-finance";
import { loadOrdersFinanceEnrichment } from "../src/modules/orders/domain/order.detail-finance";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("orders + mobile finance use loadClientBalanceView", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("getMobileOrderClientFinance account_balance ≡ ledger_merged view", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const agent = await prisma.user.findFirst({
      where: { tenant_id: tenantId, role: "agent", is_active: true }
    });
    expect(agent).toBeTruthy();

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `fin-view-${Date.now()}`,
        client_code: `FV-${Date.now()}`.slice(0, 32),
        is_active: true,
        credit_limit: new Prisma.Decimal(0)
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("-15.25"),
        note: "fin-view-seed"
      })
    );

    const finance = await getMobileOrderClientFinance(tenantId, agent!.id, client.id);
    expect(finance).toBeTruthy();

    const view = await loadClientBalanceView(tenantId, [client.id], "ledger_merged");
    expect(finance!.account_balance).toBe(
      (view.get(client.id) ?? new Prisma.Decimal(0)).toString()
    );
  });

  it("loadOrdersFinanceEnrichment balance ≡ ledger_merged view", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const warehouse =
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId, type: "main" } })) ??
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId } }));
    expect(warehouse).toBeTruthy();

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `ord-fin-${Date.now()}`,
        client_code: `OF-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("88"),
        note: "ord-fin-seed"
      })
    );

    const order = await prisma.order.create({
      data: {
        tenant_id: tenantId,
        number: `OF-${Date.now()}`,
        client_id: client.id,
        warehouse_id: warehouse!.id,
        order_type: "order",
        status: "new",
        total_sum: new Prisma.Decimal(10),
        discount_sum: new Prisma.Decimal(0)
      }
    });

    const enrich = await loadOrdersFinanceEnrichment(tenantId, [
      {
        id: order.id,
        client_id: client.id,
        order_type: "order",
        status: "new",
        total_sum: order.total_sum,
        discount_sum: order.discount_sum,
        applied_auto_bonus_rule_ids: []
      }
    ]);

    const view = await loadClientBalanceView(tenantId, [client.id], "ledger_merged");
    expect(enrich.get(order.id)?.balance).toBe(
      (view.get(client.id) ?? new Prisma.Decimal(0)).toString()
    );
  });
});
