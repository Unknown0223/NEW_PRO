import type { Prisma } from "@prisma/client";
import JSZip from "jszip";
import type { MigrationIdMaps } from "./system-migration.id-maps";
import { createManyChunked } from "./system-migration.import.batch";
import {
  hydrateDates,
  hydrateDecimals,
  readZipJson,
  remapId,
  stripIdTenant
} from "./system-migration.parse";

type Tx = Prisma.TransactionClient;

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

  const refusalData: Prisma.ClientRefusalUncheckedCreateInput[] = [];
  for (const row of refusals) {
    const clientId = remapId(maps.client, row.client_id);
    const agentId = remapId(maps.user, row.agent_id);
    if (clientId == null || agentId == null) continue;
    const data = hydrateDates(stripIdTenant(row), ["created_at"]);
    refusalData.push({
      ...(data as Prisma.ClientRefusalUncheckedCreateInput),
      tenant_id: tenantId,
      client_id: clientId,
      agent_id: agentId
    });
  }
  counts.client_refusals = await createManyChunked(
    (args) => tx.clientRefusal.createMany(args),
    refusalData
  );

  const visitData: Prisma.AgentVisitUncheckedCreateInput[] = [];
  for (const row of visits) {
    const agentId = remapId(maps.user, row.agent_id);
    if (agentId == null) continue;
    const data = hydrateDecimals(
      hydrateDates(stripIdTenant(row), ["checked_in_at", "checked_out_at"]),
      ["latitude", "longitude"]
    );
    visitData.push({
      ...(data as Prisma.AgentVisitUncheckedCreateInput),
      tenant_id: tenantId,
      agent_id: agentId,
      client_id: remapId(maps.client, data.client_id) ?? null
    });
  }
  counts.agent_visits = await createManyChunked((args) => tx.agentVisit.createMany(args), visitData);

  const pingData: Prisma.AgentLocationPingUncheckedCreateInput[] = [];
  for (const row of pings) {
    const agentId = remapId(maps.user, row.agent_id);
    if (agentId == null) continue;
    const data = hydrateDecimals(hydrateDates(stripIdTenant(row), ["recorded_at"]), [
      "latitude",
      "longitude"
    ]);
    pingData.push({
      ...(data as Prisma.AgentLocationPingUncheckedCreateInput),
      tenant_id: tenantId,
      agent_id: agentId
    });
  }
  counts.agent_location_pings = await createManyChunked(
    (args) => tx.agentLocationPing.createMany(args),
    pingData
  );

  const expenseData: Prisma.ExpenseUncheckedCreateInput[] = [];
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
    expenseData.push({
      ...(data as Prisma.ExpenseUncheckedCreateInput),
      tenant_id: tenantId,
      agent_id: remapId(maps.user, data.agent_id) ?? null,
      warehouse_id: remapId(maps.warehouse, data.warehouse_id) ?? null,
      created_by_user_id: remapId(maps.user, data.created_by_user_id) ?? null,
      approved_by_user_id: remapId(maps.user, data.approved_by_user_id) ?? null,
      deleted_by_user_id: remapId(maps.user, data.deleted_by_user_id) ?? null
    });
  }
  counts.expenses = await createManyChunked((args) => tx.expense.createMany(args), expenseData);

  const allocationData: Prisma.PaymentAllocationUncheckedCreateInput[] = [];
  for (const row of allocations) {
    const paymentId = remapId(maps.payment, row.payment_id);
    const orderId = remapId(maps.order, row.order_id);
    if (paymentId == null || orderId == null) continue;
    const data = hydrateDecimals(hydrateDates(stripIdTenant(row), ["created_at"]), ["amount"]);
    allocationData.push({
      ...(data as Prisma.PaymentAllocationUncheckedCreateInput),
      tenant_id: tenantId,
      payment_id: paymentId,
      order_id: orderId
    });
  }
  counts.payment_allocations = await createManyChunked(
    (args) => tx.paymentAllocation.createMany(args),
    allocationData
  );

  return counts;
}
