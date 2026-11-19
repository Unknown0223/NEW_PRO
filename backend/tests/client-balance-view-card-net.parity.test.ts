/**
 * Characterization: loadLedgerCardNetByClient ≡ fixture expected_net (CN-01…CN-17).
 * Production o‘zgarmaydi; ClientBalanceView / Payment List / PL testlari yo‘q.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import { loadLedgerCardNetByClient } from "../src/modules/client-balances/client-balances.ledger";
import {
  CARD_NET_CASES,
  type CardNetCase,
  type CardNetClientSpec,
  type CardNetEvent
} from "./fixtures/client-balance-view-card-net.cases";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const RUN = process.env.VITEST_TEST_RUN_ID ?? "local";
const TAG = `[vitest-card-net-${RUN}]`;

function dec(s: string): Prisma.Decimal {
  return new Prisma.Decimal(s);
}

function netOf(map: Map<number, Prisma.Decimal>, clientId: number): Prisma.Decimal {
  return map.get(clientId) ?? new Prisma.Decimal(0);
}

describe.skipIf(!dbReady)("card_net characterization (loadLedgerCardNetByClient)", () => {
  let tenantId = 0;
  let warehouseId = 0;
  const createdClientIds: number[] = [];
  const createdOrderIds: number[] = [];
  const createdPaymentIds: number[] = [];
  const createdSalesReturnIds: number[] = [];

  beforeAll(async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "test1" } });
    expect(tenant).toBeTruthy();
    tenantId = tenant!.id;

    const wh =
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId, type: "main" } })) ??
      (await prisma.warehouse.findFirst({ where: { tenant_id: tenantId } }));
    expect(wh).toBeTruthy();
    warehouseId = wh!.id;
  });

  afterAll(async () => {
    if (createdPaymentIds.length > 0) {
      await prisma.paymentAllocation.deleteMany({
        where: { tenant_id: tenantId, payment_id: { in: createdPaymentIds } }
      });
      await prisma.payment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdSalesReturnIds.length > 0) {
      await prisma.salesReturnLine.deleteMany({
        where: { return_id: { in: createdSalesReturnIds } }
      });
      await prisma.salesReturn.deleteMany({ where: { id: { in: createdSalesReturnIds } } });
    }
    if (createdOrderIds.length > 0) {
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (createdClientIds.length > 0) {
      await prisma.clientBalanceMovement.deleteMany({
        where: { client_balance: { tenant_id: tenantId, client_id: { in: createdClientIds } } }
      });
      await prisma.clientBalance.deleteMany({
        where: { tenant_id: tenantId, client_id: { in: createdClientIds } }
      });
      await prisma.client.deleteMany({ where: { id: { in: createdClientIds } } });
    }
    await prisma.$disconnect();
  });

  async function createClient(caseId: string, key: string): Promise<number> {
    const suffix = `${caseId}-${key}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `${TAG} ${suffix}`,
        client_code: `CN${suffix}`.slice(0, 32),
        is_active: true
      }
    });
    createdClientIds.push(client.id);
    return client.id;
  }

  async function applyEvents(
    clientId: number,
    caseId: string,
    clientKey: string,
    events: CardNetEvent[]
  ): Promise<void> {
    const orderByRef = new Map<string, number>();
    const srByRef = new Map<string, { id: number; number: string }>();

    for (const ev of events) {
      if (ev.type === "client_balance") {
        await prisma.clientBalance.upsert({
          where: {
            tenant_id_client_id: { tenant_id: tenantId, client_id: clientId }
          },
          create: {
            tenant_id: tenantId,
            client_id: clientId,
            balance: dec(ev.balance)
          },
          update: { balance: dec(ev.balance) }
        });
        continue;
      }

      if (ev.type === "order") {
        const number = `${TAG}-${caseId}-${clientKey}-${ev.ref}-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
        const order = await prisma.order.create({
          data: {
            tenant_id: tenantId,
            number,
            client_id: clientId,
            warehouse_id: warehouseId,
            order_type: ev.order_type ?? "order",
            status: ev.status,
            total_sum: dec(ev.total),
            created_at: ev.created_at ? new Date(ev.created_at) : new Date()
          }
        });
        createdOrderIds.push(order.id);
        orderByRef.set(ev.ref, order.id);
        continue;
      }

      if (ev.type === "sales_return") {
        const number = `${ev.number}-${caseId}-${clientKey}-${Date.now()}`.slice(0, 48);
        const mirrorId = ev.mirror_order_ref ? orderByRef.get(ev.mirror_order_ref) : undefined;
        const orderId = ev.order_ref ? orderByRef.get(ev.order_ref) : undefined;
        if (ev.mirror_order_ref && mirrorId == null) {
          throw new Error(`${caseId}: mirror_order_ref ${ev.mirror_order_ref} topilmadi`);
        }
        if (ev.order_ref && orderId == null) {
          throw new Error(`${caseId}: order_ref ${ev.order_ref} topilmadi`);
        }
        const sr = await prisma.salesReturn.create({
          data: {
            tenant_id: tenantId,
            number,
            client_id: clientId,
            warehouse_id: warehouseId,
            status: ev.status ?? "posted",
            refund_amount: dec(ev.refund_amount),
            mirror_order_id: mirrorId ?? null,
            order_id: orderId ?? null,
            accepted_at: ev.accepted_at ? new Date(ev.accepted_at) : new Date(),
            created_at: ev.accepted_at ? new Date(ev.accepted_at) : new Date()
          }
        });
        createdSalesReturnIds.push(sr.id);
        srByRef.set(ev.ref, { id: sr.id, number: sr.number });
        continue;
      }

      if (ev.type === "payment") {
        let note = ev.note ?? null;
        if (ev.note_sr_ref) {
          const sr = srByRef.get(ev.note_sr_ref);
          if (!sr) throw new Error(`${caseId}: note_sr_ref ${ev.note_sr_ref} topilmadi`);
          note = `Возврат · ${sr.number}`;
        }
        const orderId = ev.order_ref ? orderByRef.get(ev.order_ref) : undefined;
        if (ev.order_ref && orderId == null) {
          throw new Error(`${caseId}: payment order_ref ${ev.order_ref} topilmadi`);
        }
        const payment = await prisma.payment.create({
          data: {
            tenant_id: tenantId,
            client_id: clientId,
            order_id: orderId ?? null,
            amount: dec(ev.amount),
            payment_type: "cash_uzs",
            note,
            entry_kind: ev.entry_kind ?? "payment",
            workflow_status: ev.workflow_status ?? "confirmed",
            deleted_at: ev.deleted_at ? new Date(ev.deleted_at) : null,
            paid_at: ev.paid_at ? new Date(ev.paid_at) : new Date(),
            confirmed_at:
              ev.workflow_status === "pending_confirmation" ||
              ev.workflow_status === "rejected" ||
              ev.workflow_status === "deleted"
                ? null
                : new Date()
          }
        });
        createdPaymentIds.push(payment.id);
      }
    }
  }

  async function seedCase(c: CardNetCase): Promise<Map<string, number>> {
    const ids = new Map<string, number>();
    for (const spec of c.clients) {
      const clientId = await createClient(c.id, spec.key);
      ids.set(spec.key, clientId);
      await applyEvents(clientId, c.id, spec.key, spec.events);
    }
    return ids;
  }

  function assertClientNet(
    c: CardNetCase,
    spec: CardNetClientSpec,
    clientId: number,
    actualMap: Map<number, Prisma.Decimal>
  ): void {
    const actual = netOf(actualMap, clientId);
    const expected = dec(spec.expected_net);
    expect(
      actual.eq(expected),
      `${c.id}/${spec.key}: actual=${actual.toFixed(2)} expected=${expected.toFixed(2)} | ${c.rule}`
    ).toBe(true);
  }

  for (const c of CARD_NET_CASES) {
    it(`${c.id}: ${c.title}`, async () => {
      const ids = await seedCase(c);
      const clientIds = [...ids.values()];
      const asOf = c.asOfEnd ? new Date(c.asOfEnd) : null;
      const actualMap = await loadLedgerCardNetByClient(tenantId, clientIds, asOf);

      for (const spec of c.clients) {
        const clientId = ids.get(spec.key);
        expect(clientId, `${c.id}: client key ${spec.key}`).toBeTypeOf("number");
        assertClientNet(c, spec, clientId!, actualMap);
      }
    });
  }
});
