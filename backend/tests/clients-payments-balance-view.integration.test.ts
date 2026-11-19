/**
 * ADR-006 M1.3–4: clients ledger get + payments list enrich → loadClientBalanceView.
 * Call site’da qayta merge assert yo‘q — faqat view natijasiga tenglik.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { applyDelta } from "../src/modules/client-balances/client-balance-mutator";
import { loadClientBalanceView } from "../src/modules/client-balances/client-balance-view";
import { getClientBalanceLedger } from "../src/modules/clients/client-balance-ledger.get";
import { getClientDetail } from "../src/modules/clients/clients.detail";
import { listPaymentsForClient } from "../src/modules/payments/payment.query.read";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("clients + payments list use loadClientBalanceView", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("getClientBalanceLedger account_balance ≡ ledger_merged view", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `led-view-${Date.now()}`,
        client_code: `LV-${Date.now()}`.slice(0, 32),
        is_active: true,
        credit_limit: new Prisma.Decimal(0)
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("-42.5"),
        note: "led-view-seed"
      })
    );

    const ledger = await getClientBalanceLedger(tenantId, client.id, { page: 1, limit: 20 });
    const view = await loadClientBalanceView(tenantId, [client.id], "ledger_merged");
    expect(ledger.account_balance).toBe(
      (view.get(client.id) ?? new Prisma.Decimal(0)).toString()
    );
  });

  it("getClientDetail account_balance ≡ ledger_merged view", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `det-view-${Date.now()}`,
        client_code: `DV-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("17"),
        note: "det-view-seed"
      })
    );

    const detail = await getClientDetail(tenantId, client.id);
    const view = await loadClientBalanceView(tenantId, [client.id], "ledger_merged");
    expect(detail.account_balance).toBe(
      (view.get(client.id) ?? new Prisma.Decimal(0)).toString()
    );
  });

  it("listPaymentsForClient client_balance ≡ card_net view", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `pay-view-${Date.now()}`,
        client_code: `PV-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("55"),
        note: "pay-view-seed"
      })
    );

    await prisma.payment.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        amount: new Prisma.Decimal(10),
        payment_type: "cash_uzs",
        entry_kind: "payment",
        workflow_status: "confirmed",
        paid_at: new Date(),
        confirmed_at: new Date(),
        note: "pay-view-row"
      }
    });

    const rows = await listPaymentsForClient(tenantId, client.id, 10);
    expect(rows.length).toBeGreaterThan(0);

    const view = await loadClientBalanceView(tenantId, [client.id], "card_net");
    const expected = (view.get(client.id) ?? new Prisma.Decimal(0)).toString();
    for (const row of rows) {
      expect(row.client_balance).toBe(expected);
    }
  });
});
