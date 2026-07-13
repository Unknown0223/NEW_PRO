import { prisma } from "../../config/database";
import { loadClientPreviewsMap } from "./client-dedupe.service";
import {
  CLIENT_MERGE_CONSEQUENCES,
  CLIENT_MERGE_IRREVERSIBLE
} from "./clients.merge.constants";
import { mergePreviewConflictLevel } from "./clients.merge.internals";
import { Prisma } from "@prisma/client";

export type MergeClientsPreviewResult = {
  keep_client_id: number;
  merge_client_ids: number[];
  orders_to_reassign: number;
  payments_to_reassign: number;
  sales_returns_to_reassign: number;
  equipment_to_reassign: number;
  photo_reports_to_reassign: number;
  visits_to_reassign: number;
  opening_balances_to_reassign: number;
  total_balance_before: string;
  master_balance_before: string;
  expected_master_balance_after: string;
  conflict_summary: {
    safe: number;
    warning: number;
    critical: number;
  };
  irreversible: true;
  consequences: readonly string[];
};

export async function previewMergeClients(
  tenantId: number,
  keepClientId: number,
  mergeClientIds: number[]
): Promise<MergeClientsPreviewResult> {
  const uniqueMerge = [...new Set(mergeClientIds)].filter((id) => id !== keepClientId);
  if (uniqueMerge.length === 0) throw new Error("NO_MERGE_TARGETS");

  const allIds = [keepClientId, ...uniqueMerge];
  const clients = await prisma.client.findMany({
    where: { id: { in: allIds }, tenant_id: tenantId },
    select: { id: true, merged_into_client_id: true }
  });
  if (clients.length !== allIds.length) throw new Error("NOT_FOUND");
  for (const c of clients) {
    if (c.merged_into_client_id != null) throw new Error("ALREADY_MERGED");
  }

  const [
    previewsMap,
    balances,
    orders_to_reassign,
    payments_to_reassign,
    sales_returns_to_reassign,
    equipment_to_reassign,
    photo_reports_to_reassign,
    visits_to_reassign,
    opening_balances_to_reassign
  ] = await Promise.all([
    loadClientPreviewsMap(tenantId, allIds),
    prisma.clientBalance.findMany({
      where: { tenant_id: tenantId, client_id: { in: allIds } },
      select: { client_id: true, balance: true }
    }),
    prisma.order.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } }),
    prisma.payment.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } }),
    prisma.salesReturn.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } }),
    prisma.clientEquipment.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } }),
    prisma.clientPhotoReport.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } }),
    prisma.agentVisit.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } }),
    prisma.clientOpeningBalanceEntry.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } })
  ]);

  const balMap = new Map<number, Prisma.Decimal>();
  for (const b of balances) balMap.set(b.client_id, b.balance);
  const sum = (ids: number[]) =>
    ids.reduce(
      (acc, id) => acc.add(new Prisma.Decimal((balMap.get(id) ?? new Prisma.Decimal(0)).toString())),
      new Prisma.Decimal(0)
    );
  const totalBefore = sum(allIds);
  const masterBefore = sum([keepClientId]);

  const previews = allIds.map((id) => previewsMap.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const conflictFields: Array<(p: NonNullable<(typeof previews)[number]>) => string | null | undefined> = [
    (p) => p.name,
    (p) => p.legal_name,
    (p) => p.phone,
    (p) => p.inn,
    (p) => p.client_pinfl,
    (p) => p.contract_number,
    (p) => p.bank_account,
    (p) => p.bank_name,
    (p) => p.bank_mfo,
    (p) => p.region,
    (p) => p.zone,
    (p) => p.city,
    (p) => p.address
  ];
  let safe = 0;
  let warning = 0;
  let critical = 0;
  for (const getField of conflictFields) {
    const level = mergePreviewConflictLevel(previews.map((p) => getField(p)));
    if (level === "safe") safe += 1;
    else if (level === "warning") warning += 1;
    else critical += 1;
  }

  return {
    keep_client_id: keepClientId,
    merge_client_ids: uniqueMerge,
    orders_to_reassign,
    payments_to_reassign,
    sales_returns_to_reassign,
    equipment_to_reassign,
    photo_reports_to_reassign,
    visits_to_reassign,
    opening_balances_to_reassign,
    total_balance_before: totalBefore.toString(),
    master_balance_before: masterBefore.toString(),
    expected_master_balance_after: totalBefore.toString(),
    conflict_summary: { safe, warning, critical },
    irreversible: CLIENT_MERGE_IRREVERSIBLE,
    consequences: CLIENT_MERGE_CONSEQUENCES
  };
}
