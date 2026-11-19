/**
 * ADR-006 M1.5: reports / consignment / returns filter → loadClientBalanceView.
 * Call site’da qayta merge assert yo‘q — faqat view natijasiga tenglik.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { applyDelta } from "../src/modules/client-balances/client-balance-mutator";
import { loadClientBalanceView } from "../src/modules/client-balances/client-balance-view";
import { listClientBalancesReport } from "../src/modules/client-balances/client-balances.report";
import { buildReturnFilterMetaForClient } from "../src/modules/returns/returns-filter.stats";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("reports + returns filter use loadClientBalanceView", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("buildReturnFilterMetaForClient client_balance ≡ ledger_merged view", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `ret-view-${Date.now()}`,
        client_code: `RV-${Date.now()}`.slice(0, 32),
        is_active: true,
        credit_limit: new Prisma.Decimal(0)
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("-33.5"),
        note: "ret-view-seed"
      })
    );

    const { meta } = await buildReturnFilterMetaForClient(tenantId, client.id);
    const view = await loadClientBalanceView(tenantId, [client.id], "ledger_merged");
    expect(meta.client_balance).toBe(
      (view.get(client.id) ?? new Prisma.Decimal(0)).toString()
    );
  });

  it("listClientBalancesReport clients row.balance ≡ card_net view", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `rep-view-${Date.now()}`,
        client_code: `RP-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    const cashDesk = await prisma.cashDesk.findFirst({ where: { tenant_id: tenantId } });
    await prisma.payment.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        cash_desk_id: cashDesk?.id ?? null,
        amount: new Prisma.Decimal("64"),
        payment_type: "cash_uzs",
        entry_kind: "payment",
        workflow_status: "confirmed",
        paid_at: new Date(),
        confirmed_at: new Date(),
        note: "rep-view-seed"
      }
    });

    const report = await listClientBalancesReport(tenantId, {
      view: "clients",
      page: 1,
      limit: 200,
      search: client.client_code!
    });

    const row = report.data.find((r) => r.client_id === client.id);
    expect(row).toBeTruthy();

    const view = await loadClientBalanceView(tenantId, [client.id], "card_net");
    expect(row!.balance).toBe((view.get(client.id) ?? new Prisma.Decimal(0)).toString());
  });
});
