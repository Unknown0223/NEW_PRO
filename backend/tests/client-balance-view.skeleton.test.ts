/**
 * ClientBalanceView skeleton: card_net delegate ≡ loadLedgerCardNetByClient.
 * Production call site / CN-01…17 fayllariga tegilmaydi.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/config/database";
import {
  loadClientBalanceView,
  type ClientBalanceViewKind
} from "../src/modules/client-balances/client-balance-view";
import { loadLedgerCardNetByClient } from "../src/modules/client-balances/client-balances.ledger";
import {
  CARD_NET_CASES,
  type CardNetCase,
  type CardNetEvent
} from "./fixtures/client-balance-view-card-net.cases";

const marker = join(__dirname, ".db-integration-ready");
const dbReady = existsSync(marker) && readFileSync(marker, "utf8").trim() === "1";

const RUN = process.env.VITEST_TEST_RUN_ID ?? "local";
const TAG = `[vitest-cbv-skel-${RUN}]`;

function dec(s: string): Prisma.Decimal {
  return new Prisma.Decimal(s);
}

function mapsEq(
  a: Map<number, Prisma.Decimal>,
  b: Map<number, Prisma.Decimal>,
  clientIds: number[]
): boolean {
  for (const id of clientIds) {
    const left = a.get(id) ?? new Prisma.Decimal(0);
    const right = b.get(id) ?? new Prisma.Decimal(0);
    if (!left.eq(right)) return false;
  }
  return true;
}

describe.skipIf(!dbReady)("ClientBalanceView skeleton (card_net)", () => {
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

  async function createClient(label: string): Promise<number> {
    const suffix = `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const client = await prisma.client.create({
      data: {
        tenant_id: tenantId,
        name: `${TAG} ${suffix}`,
        client_code: `SK${suffix}`.slice(0, 32),
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
          where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
          create: { tenant_id: tenantId, client_id: clientId, balance: dec(ev.balance) },
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
          if (!sr) throw new Error(`${caseId}: note_sr_ref ${ev.note_sr_ref}`);
          note = `Возврат · ${sr.number}`;
        }
        const orderId = ev.order_ref ? orderByRef.get(ev.order_ref) : undefined;
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

  async function seedCase(c: CardNetCase): Promise<number[]> {
    const ids: number[] = [];
    for (const spec of c.clients) {
      const clientId = await createClient(`${c.id}-${spec.key}`);
      ids.push(clientId);
      await applyEvents(clientId, c.id, spec.key, spec.events);
    }
    return ids;
  }

  it("SK-01: empty clientIds → empty Map", async () => {
    const view = await loadClientBalanceView(tenantId, [], "card_net");
    const baseline = await loadLedgerCardNetByClient(tenantId, [], null);
    expect(view.size).toBe(0);
    expect(baseline.size).toBe(0);
  });

  it("SK-02: dual-call on all CN fixtures (view ≡ loadLedgerCardNet)", async () => {
    for (const c of CARD_NET_CASES) {
      if (c.asOfEnd) continue;
      const clientIds = await seedCase(c);
      const baseline = await loadLedgerCardNetByClient(tenantId, clientIds, null);
      const view = await loadClientBalanceView(tenantId, clientIds, "card_net");
      expect(
        mapsEq(view, baseline, clientIds),
        `${c.id}: view !== loadLedgerCardNetByClient`
      ).toBe(true);
    }
  });

  it("SK-03: asOfEnd (CN-15) dual-call", async () => {
    const c = CARD_NET_CASES.find((x) => x.id === "CN-15");
    expect(c).toBeTruthy();
    const clientIds = await seedCase(c!);
    const asOf = new Date(c!.asOfEnd!);
    const baseline = await loadLedgerCardNetByClient(tenantId, clientIds, asOf);
    const view = await loadClientBalanceView(tenantId, clientIds, "card_net", { asOfEnd: asOf });
    expect(mapsEq(view, baseline, clientIds)).toBe(true);
  });

  it("SK-04: unsupported kind throws", async () => {
    const bad = "prepaid_cache" as ClientBalanceViewKind;
    await expect(loadClientBalanceView(tenantId, [], bad)).rejects.toThrow(
      /unsupported mode/
    );
  });
});
