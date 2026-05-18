import fs from "node:fs";

function linesOf(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

// ledger
{
  const lg = "src/modules/clients/client-balance-ledger.get.ts";
  const lines = linesOf(lg);
  const hdr = lines.slice(0, 27).join("\n");
  w(
    "src/modules/clients/client-balance-ledger.get-table.ts",
    `${hdr}
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import type { ClientLedgerRow } from "./client-balance-ledger.types";

export type LedgerTableQueryCtx = {
  tenantId: number;
  clientId: number;
  excluded: readonly string[];
  orderDateClause: import("@prisma/client").Prisma.Sql;
  payDateClause: import("@prisma/client").Prisma.Sql;
  orderSearchClause: import("@prisma/client").Prisma.Sql;
  paySearchClause: import("@prisma/client").Prisma.Sql;
  kindWhere: import("@prisma/client").Prisma.Sql;
  orderAgentClause: import("@prisma/client").Prisma.Sql;
  payAgentClause: import("@prisma/client").Prisma.Sql;
  rankedCte: import("@prisma/client").Prisma.Sql;
  fromTable: import("@prisma/client").Prisma.Sql;
  limit: number;
  offset: number;
  paymentMethodEntries: PaymentMethodEntryDto[];
};

export async function fetchClientBalanceLedgerTable(
  ctx: LedgerTableQueryCtx
): Promise<{ rows: ClientLedgerRow[]; total: number }> {
${lines.slice(249, 389).join("\n")}
  return { rows, total };
}
`
  );
  w(
    lg,
    `${hdr}
import { fetchClientBalanceLedgerTable } from "./client-balance-ledger.get-table";

export async function getClientBalanceLedger(
  tenantId: number,
  clientId: number,
  q: ClientLedgerQuery
): Promise<ClientBalanceLedgerResponse> {
${lines.slice(32, 249).join("\n")}
  const { rows, total } = await fetchClientBalanceLedgerTable({
    tenantId,
    clientId,
    excluded,
    orderDateClause,
    payDateClause,
    orderSearchClause,
    paySearchClause,
    kindWhere,
    orderAgentClause,
    payAgentClause,
    rankedCte,
    fromTable,
    limit,
    offset,
    paymentMethodEntries
  });

  return {
    client: {
      id: client.id,
      name: client.name,
      phone: client.phone,
      client_code: client.client_code,
      territory_label: territoryLabel(client),
      agent_id: client.agent_id ?? null
    },
    account_balance,
    ledger_net_balance,
    summary_payment_by_type,
    agent_cards: agent_cards_with_ledger_totals,
    rows,
    total,
    page,
    limit
  };
}
`
  );
}

// create-batch
{
  const cb = "src/modules/returns/returns-enhanced.create-batch.ts";
  const lines = linesOf(cb);
  const hdr = lines.slice(0, 32).join("\n");
  w(
    "src/modules/returns/returns-enhanced.create-batch.prepare.ts",
    `${hdr}
export type PreparedPeriodReturnSlice = {
  orderId: number;
  sourceOrderNumber: string;
  retLines: Array<{
    product_id: number;
    qty: number;
    paid_qty: number;
    bonus_qty: number;
    price: number;
  }>;
  recalc: {
    original_bonus_qty: number;
    remaining_bonus_qty: number;
    excess_bonus: number;
    total_return_qty: number;
    paid_return_qty: number;
    bonus_return_qty: number;
    refund_amount: import("@prisma/client").Prisma.Decimal;
  };
  number: string;
};

export type PreparePeriodReturnBatchResult = {
  tenantId: number;
  input: import("./returns-enhanced.types").CreatePeriodReturnBatchInput;
  actorUserId: number | null;
  prepared: PreparedPeriodReturnSlice[];
  warehouseId: number;
  uid: number | null;
  pMap: Map<number, { sku: string; name: string }>;
};

export async function preparePeriodReturnBatch(
  tenantId: number,
  input: import("./returns-enhanced.types").CreatePeriodReturnBatchInput,
  actorUserId: number | null
): Promise<PreparePeriodReturnBatchResult> {
${lines.slice(38, 282).join("\n")}
  return { tenantId, input, actorUserId, prepared, warehouseId, uid, pMap };
}
`
  );
  w(
    "src/modules/returns/returns-enhanced.create-batch.persist.ts",
    `${hdr}
import type { PeriodReturnBatchResult } from "./returns-enhanced.types";
import type { PreparePeriodReturnBatchResult } from "./returns-enhanced.create-batch.prepare";

export async function persistPeriodReturnBatch(
  prep: PreparePeriodReturnBatchResult
): Promise<PeriodReturnBatchResult> {
  const { tenantId, input, actorUserId, prepared, warehouseId, uid, pMap } = prep;
${lines.slice(283, 438).join("\n")}
}
`
  );
  w(
    cb,
    `${hdr}
import type { CreatePeriodReturnBatchInput, PeriodReturnBatchResult } from "./returns-enhanced.types";
import { persistPeriodReturnBatch } from "./returns-enhanced.create-batch.persist";
import { preparePeriodReturnBatch } from "./returns-enhanced.create-batch.prepare";

export async function createPeriodReturnBatch(
  tenantId: number,
  input: CreatePeriodReturnBatchInput,
  actorUserId: number | null
): Promise<PeriodReturnBatchResult> {
  const prep = await preparePeriodReturnBatch(tenantId, input, actorUserId);
  return persistPeriodReturnBatch(prep);
}
`
  );
}

console.log("phase67b done");
