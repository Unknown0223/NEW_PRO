import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { applyClientBonusDebt } from "../src/modules/returns/returns-enhanced.bonus-debt";
import { applyClientDiscountDebt } from "../src/modules/returns/returns-enhanced.discount-debt";
import { applyClientReturnRefund } from "../src/modules/returns/returns-enhanced.refund-ledger";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("returns balance writes via applyDelta", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("refund increments balance; bonus/discount debt decrement with return notes", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `ret-bal-${Date.now()}`,
        client_code: `RB-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.clientBalance.deleteMany({
      where: { tenant_id: tenantId, client_id: client.id }
    });

    await prisma.$transaction(async (tx) => {
      await applyClientReturnRefund(tx, tenantId, client.id, "100.00", null, {
        returnNumber: "VR-TEST-1"
      });
      await applyClientBonusDebt(tx, tenantId, client.id, "30.00", null, {
        returnNumber: "VR-TEST-1"
      });
      await applyClientDiscountDebt(tx, tenantId, client.id, "20.00", null, {
        returnNumber: "VR-TEST-1",
        note: "Долг скидка · test"
      });
    });

    const bal = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(bal).toBeTruthy();
    // +100 refund, -30 bonus debt, -20 discount debt
    expect(bal!.balance.toString()).toBe("50");

    const movements = await prisma.clientBalanceMovement.findMany({
      where: { client_balance_id: bal!.id },
      orderBy: { id: "asc" }
    });
    expect(movements).toHaveLength(3);
    expect(movements[0]!.delta.toString()).toBe("100");
    expect(movements[0]!.note).toContain("VR-TEST-1");
    expect(movements[1]!.delta.toString()).toBe("-30");
    expect(movements[1]!.note).toContain("Долг бонус");
    expect(movements[2]!.delta.toString()).toBe("-20");
    expect(movements[2]!.note).toContain("Долг скидка");
  });

  it("skipBalance on refund does not touch client balance", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `ret-skip-${Date.now()}`,
        client_code: `RS-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.$transaction(async (tx) => {
      await applyClientReturnRefund(tx, tenantId, client.id, "55.00", null, {
        returnNumber: "VR-SKIP",
        skipBalance: true
      });
    });

    const bal = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(bal).toBeNull();

    const pay = await prisma.payment.findFirst({
      where: { tenant_id: tenantId, client_id: client.id, entry_kind: "refund" },
      orderBy: { id: "desc" }
    });
    expect(pay).toBeTruthy();
    expect(pay!.amount.toString()).toBe("55");
  });
});
