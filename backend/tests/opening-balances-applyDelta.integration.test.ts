import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import {
  deleteOpeningBalance,
  restoreOpeningBalance
} from "../src/modules/opening-balances/opening-balances.write";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("opening-balances legacy void/restore via applyDelta", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("legacy surplus: void reverses then restore re-applies with opening notes", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `ob-legacy-${Date.now()}`,
        client_code: `OB-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.clientBalance.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        balance: new Prisma.Decimal(200)
      }
    });

    // payment_id=null → legacy path (to‘g‘ridan applyDelta)
    const entry = await prisma.clientOpeningBalanceEntry.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        balance_type: "surplus",
        amount: new Prisma.Decimal(50),
        payment_type: "cash_uzs",
        payment_id: null,
        note: "legacy surplus"
      }
    });

    await deleteOpeningBalance(tenantId, entry.id, null, "vitest-void");

    const afterVoid = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(afterVoid!.balance.toString()).toBe("150");

    const voided = await prisma.clientOpeningBalanceEntry.findUnique({ where: { id: entry.id } });
    expect(voided!.deleted_at).not.toBeNull();

    await restoreOpeningBalance(tenantId, entry.id, null);

    const afterRestore = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(afterRestore!.balance.toString()).toBe("200");

    const movements = await prisma.clientBalanceMovement.findMany({
      where: { client_balance_id: afterRestore!.id },
      orderBy: { id: "asc" }
    });
    const notes = movements.map((m) => m.note ?? "");
    expect(notes.some((n) => n.includes(`Начальный баланс #${entry.id} в архив`))).toBe(true);
    expect(notes.some((n) => n.includes(`Начальный баланс #${entry.id} восстановлен`))).toBe(true);
  });

  it("legacy debt void without balance row skips inventing a row", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `ob-nobalk-${Date.now()}`,
        client_code: `ON-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    const entry = await prisma.clientOpeningBalanceEntry.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        balance_type: "debt",
        amount: new Prisma.Decimal(10),
        payment_type: "cash_uzs",
        payment_id: null
      }
    });

    await deleteOpeningBalance(tenantId, entry.id, null, null);

    const bal = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(bal).toBeNull();

    const voided = await prisma.clientOpeningBalanceEntry.findUnique({ where: { id: entry.id } });
    expect(voided!.deleted_at).not.toBeNull();
  });
});
