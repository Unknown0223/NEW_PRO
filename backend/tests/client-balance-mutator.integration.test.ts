import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { applyDelta } from "../src/modules/client-balances/client-balance-mutator";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

describe.skipIf(!dbReady)("ClientBalanceMutator applyDelta", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects delta === 0 with BAD_DELTA", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const client = await prisma.client.findFirst({
      where: { tenant_id: tenant!.id, merged_into_client_id: null }
    });
    expect(client).toBeTruthy();

    await expect(
      prisma.$transaction((tx) =>
        applyDelta(tx, {
          tenantId: tenant!.id,
          clientId: client!.id,
          delta: new Prisma.Decimal(0),
          note: "zero"
        })
      )
    ).rejects.toThrow("BAD_DELTA");
  });

  it("creates balance row at 0 then applies delta and always writes movement", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `mutator-create-${Date.now()}`,
        client_code: `MUT-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.clientBalance.deleteMany({
      where: { tenant_id: tenantId, client_id: client.id }
    });

    const result = await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("12.50"),
        note: "create-if-missing",
        userId: null
      })
    );

    expect(result.balance.toString()).toBe("12.5");

    const bal = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(bal).toBeTruthy();
    expect(bal!.balance.toString()).toBe("12.5");

    const movements = await prisma.clientBalanceMovement.findMany({
      where: { client_balance_id: bal!.id },
      orderBy: { id: "asc" }
    });
    expect(movements).toHaveLength(1);
    expect(movements[0]!.delta.toString()).toBe("12.5");
    expect(movements[0]!.note).toBe("create-if-missing");
  });

  it("increments existing locked row and appends movement", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    const tenantId = tenant!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `mutator-inc-${Date.now()}`,
        client_code: `MUT-I-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } },
      create: { tenant_id: tenantId, client_id: client.id, balance: new Prisma.Decimal(100) },
      update: { balance: new Prisma.Decimal(100) }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal("-7.25"),
        note: "increment-existing"
      })
    );

    const bal = await prisma.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: client.id } }
    });
    expect(bal!.balance.toString()).toBe("92.75");

    const last = await prisma.clientBalanceMovement.findFirst({
      where: { client_balance_id: bal!.id },
      orderBy: { id: "desc" }
    });
    expect(last!.delta.toString()).toBe("-7.25");
  });

  it("scopes lock/update to tenant_id + client_id pair", async () => {
    const t1 = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(t1).toBeTruthy();
    const tenantId = t1!.id;

    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `mutator-scope-${Date.now()}`,
        client_code: `MUT-S-${Date.now()}`.slice(0, 32),
        is_active: true
      }
    });

    await prisma.clientBalance.create({
      data: {
        tenant_id: tenantId,
        client_id: client.id,
        balance: new Prisma.Decimal(40)
      }
    });

    await prisma.$transaction((tx) =>
      applyDelta(tx, {
        tenantId,
        clientId: client.id,
        delta: new Prisma.Decimal(5),
        note: "tenant-scope"
      })
    );

    const rows = await prisma.clientBalance.findMany({
      where: { client_id: client.id }
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tenant_id).toBe(tenantId);
    expect(rows[0]!.balance.toString()).toBe("45");
  });

  it("source locks with FOR UPDATE on tenant_id + client_id", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(__dirname, "../src/modules/client-balances/client-balance-mutator.ts"),
      "utf8"
    );
    expect(src).toMatch(/FOR UPDATE/);
    expect(src).toMatch(/tenant_id = \$\{args\.tenantId\}/);
    expect(src).toMatch(/client_id = \$\{args\.clientId\}/);
  });
});
