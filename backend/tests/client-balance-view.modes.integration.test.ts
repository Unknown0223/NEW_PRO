import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { applyDelta } from "../src/modules/client-balances/client-balance-mutator";
import { loadClientBalanceView } from "../src/modules/client-balances/client-balance-view";
import { loadLedgerCardNetByClient } from "../src/modules/client-balances/client-balances.ledger";
import {
  loadDeliveryDebtByClient,
  mergeLedgerWithUnpaidDelivered
} from "../src/modules/client-balances/client-balances.delivery";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("ClientBalanceView modes (ADR-006)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("card_net without asOfEnd matches loadLedgerCardNetByClient(null)", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `cbv-cn-${Date.now()}`,
        client_code: `CN-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    const ids = [client.id];
    const view = await loadClientBalanceView(tenantId, ids, "card_net");
    const baseline = await loadLedgerCardNetByClient(tenantId, ids, null);
    expect((view.get(client.id) ?? new Prisma.Decimal(0)).toString()).toBe(
      (baseline.get(client.id) ?? new Prisma.Decimal(0)).toString()
    );
  });

  it("card_net with asOfEnd matches helper", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `cbv-cn-asof-${Date.now()}`,
        client_code: `CA-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    const asOfEnd = new Date();
    const ids = [client.id];
    const view = await loadClientBalanceView(tenantId, ids, "card_net", { asOfEnd });
    const baseline = await loadLedgerCardNetByClient(tenantId, ids, asOfEnd);
    expect((view.get(client.id) ?? new Prisma.Decimal(0)).toString()).toBe(
      (baseline.get(client.id) ?? new Prisma.Decimal(0)).toString()
    );
  });

  it("ledger_merged without asOfEnd uses live row + delivery merge", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `cbv-mrg-${Date.now()}`,
        client_code: `MG-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("125.50"),
        note: "cbv-merged-seed"
      })
    );

    const ids = [client.id];
    const view = await loadClientBalanceView(tenantId, ids, "ledger_merged");
    const delivery = await loadDeliveryDebtByClient(tenantId, ids);
    const expected = mergeLedgerWithUnpaidDelivered(
      new Prisma.Decimal("125.50"),
      delivery.get(client.id)
    );
    expect((view.get(client.id) ?? new Prisma.Decimal(0)).toString()).toBe(expected.toString());
  });

  it("ledger_merged with asOfEnd uses movements up to that time", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `cbv-mrg-asof-${Date.now()}`,
        client_code: `MA-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("40"),
        note: "cbv-asof-seed"
      })
    );

    const ids = [client.id];
    const before = await loadClientBalanceView(tenantId, ids, "ledger_merged", {
      asOfEnd: past
    });
    // Movement hozir yaratilgan — past cutoff dan oldin delta yo‘q
    expect((before.get(client.id) ?? new Prisma.Decimal(0)).toString()).toBe("0");

    const withNow = await loadClientBalanceView(tenantId, ids, "ledger_merged", {
      asOfEnd: new Date()
    });
    const delivery = await loadDeliveryDebtByClient(tenantId, ids);
    const expected = mergeLedgerWithUnpaidDelivered(
      new Prisma.Decimal("40"),
      delivery.get(client.id)
    );
    expect((withNow.get(client.id) ?? new Prisma.Decimal(0)).toString()).toBe(expected.toString());
  });
});
