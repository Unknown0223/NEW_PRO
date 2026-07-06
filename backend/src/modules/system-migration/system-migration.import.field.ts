import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import {
  hydrateDates,
  hydrateDecimals,
  readZipJson,
  remapId,
  stripIdTenant
} from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

function requireMap(maps: MigrationIdMaps, kind: keyof MigrationIdMaps, oldId: unknown, label: string): number | null {
  if (oldId == null) return null;
  const mapped = remapId(maps[kind], oldId);
  if (mapped == null) throw new Error(`MAP_MISSING:${label}:${oldId}`);
  return mapped;
}

export async function importFieldActivityTables(
  tx: Tx,
  zip: JSZip,
  tenantId: number,
  maps: MigrationIdMaps
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  const [refusals, visits, pings, expenses, allocations] = await Promise.all([
    readZipJson<Record<string, unknown>>(zip, "data/client_refusals.json"),
    readZipJson<Record<string, unknown>>(zip, "data/agent_visits.json"),
    readZipJson<Record<string, unknown>>(zip, "data/agent_location_pings.json"),
    readZipJson<Record<string, unknown>>(zip, "data/expenses.json"),
    readZipJson<Record<string, unknown>>(zip, "data/payment_allocations.json")
  ]);

  for (const row of refusals) {
    const clientId = requireMap(maps, "client", row.client_id, "refusal.client_id");
    const agentId = requireMap(maps, "user", row.agent_id, "refusal.agent_id");
    if (clientId == null || agentId == null) continue;
    const data = hydrateDates(stripIdTenant(row), ["created_at"]);
    await tx.clientRefusal.create({
      data: {
        ...(data as Prisma.ClientRefusalUncheckedCreateInput),
        tenant_id: tenantId,
        client_id: clientId,
        agent_id: agentId
      }
    });
  }
  counts.client_refusals = refusals.length;

  for (const row of visits) {
    const agentId = requireMap(maps, "user", row.agent_id, "visit.agent_id");
    if (agentId == null) continue;
    const data = hydrateDecimals(
      hydrateDates(stripIdTenant(row), ["checked_in_at", "checked_out_at"]),
      ["latitude", "longitude"]
    );
    await tx.agentVisit.create({
      data: {
        ...(data as Prisma.AgentVisitUncheckedCreateInput),
        tenant_id: tenantId,
        agent_id: agentId,
        client_id: remapId(maps.client, data.client_id) ?? null
      }
    });
  }
  counts.agent_visits = visits.length;

  for (const row of pings) {
    const agentId = requireMap(maps, "user", row.agent_id, "ping.agent_id");
    if (agentId == null) continue;
    const data = hydrateDecimals(hydrateDates(stripIdTenant(row), ["recorded_at"]), [
      "latitude",
      "longitude"
    ]);
    await tx.agentLocationPing.create({
      data: {
        ...(data as Prisma.AgentLocationPingUncheckedCreateInput),
        tenant_id: tenantId,
        agent_id: agentId
      }
    });
  }
  counts.agent_location_pings = pings.length;

  for (const row of expenses) {
    const data = hydrateDecimals(
      hydrateDates(stripIdTenant(row), [
        "expense_date",
        "created_at",
        "updated_at",
        "deleted_at"
      ]),
      ["amount"]
    );
    await tx.expense.create({
      data: {
        ...(data as Prisma.ExpenseUncheckedCreateInput),
        tenant_id: tenantId,
        agent_id: remapId(maps.user, data.agent_id) ?? null,
        warehouse_id: remapId(maps.warehouse, data.warehouse_id) ?? null,
        created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null,
        approved_by_user_id: remapId(maps.user, data.approved_by_user_id) ?? null,
        deleted_by_user_id: remapId(maps.user, data.deleted_by_user_id) ?? null
      }
    });
  }
  counts.expenses = expenses.length;

  for (const row of allocations) {
    const paymentId = requireMap(maps, "payment", row.payment_id, "allocation.payment_id");
    const orderId = requireMap(maps, "order", row.order_id, "allocation.order_id");
    if (paymentId == null || orderId == null) continue;
    const data = hydrateDecimals(hydrateDates(stripIdTenant(row), ["created_at"]), ["amount"]);
    await tx.paymentAllocation.create({
      data: {
        ...(data as Prisma.PaymentAllocationUncheckedCreateInput),
        tenant_id: tenantId,
        payment_id: paymentId,
        order_id: orderId
      }
    });
  }
  counts.payment_allocations = allocations.length;

  return counts;
}
