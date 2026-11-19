import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import {
  postConfirmedPaymentAmount,
  reversePayment
} from "../src/modules/payments/payment-balance.adapters";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("payment balance adapters → applyDelta", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("void path: postConfirmed then reversePayment restores balance", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `pay-adapter-${Date.now()}`,
        client_code: `PA-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.clientBalance.deleteMany({
      where: { tenant_id: tenantId, client_id: client.id }
    });

    const payment = {
      id: 9_001_001,
      client_id: client.id,
      amount: new Prisma.Decimal("77.00"),
      entry_kind: "payment",
      workflow_status: "confirmed"
    };

    await prisma.$transaction((tx) =>
      postConfirmedPaymentAmount(tx, {
        tenantId,
        payment,
        note: `Оплата #${payment.id}`,
        userId: null
      })
    );

    const afterPost = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(afterPost!.balance.toString()).toBe("77");

    await prisma.$transaction((tx) =>
      reversePayment(tx, {
        tenantId,
        payment,
        note: `Оплата #${payment.id} отменена (архив)`,
        userId: null
      })
    );

    const afterVoid = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(afterVoid!.balance.toString()).toBe("0");

    const movements = await prisma.clientBalanceMovement.findMany({
      where: { client_balance_id: afterVoid!.id },
      orderBy: { id: "asc" }
    });
    expect(movements).toHaveLength(2);
    expect(movements[0]!.delta.toString()).toBe("77");
    expect(movements[1]!.delta.toString()).toBe("-77");
  });

  it("reversePayment skips pending_confirmation (no movement)", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `pay-pending-${Date.now()}`,
        client_code: `PP-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.clientBalance.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        balance: new Prisma.Decimal(15)
      }
    });

    const result = await prisma.$transaction((tx) =>
      reversePayment(tx, {
        tenantId,
        payment: {
          id: 9_001_002,
          client_id: client.id,
          amount: new Prisma.Decimal(15),
          entry_kind: "payment",
          workflow_status: "pending_confirmation"
        },
        note: "skip"
      })
    );
    expect(result).toBeNull();

    const bal = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(bal!.balance.toString()).toBe("15");

    const movements = await prisma.clientBalanceMovement.count({
      where: { client_balance_id: bal!.id }
    });
    expect(movements).toBe(0);
  });
});
