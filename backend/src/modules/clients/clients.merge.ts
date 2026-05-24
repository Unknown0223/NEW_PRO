import { prisma } from "../../config/database";
import { loadClientPreviewsMap } from "./client-dedupe.service";
import { appendClientAuditLog } from "./clients.audit";
import {
  consolidateClientBalancesForMerge,
  mergePreviewConflictLevel,
  reassignAgentAssignmentsForMerge
} from "./clients.merge.internals";
import { Prisma } from "@prisma/client";

export type MergeClientsResult = {
  kept: number;
  merged: number[];
  orders_reassigned: number;
  payments_reassigned: number;
  sales_returns_reassigned: number;
  equipment_reassigned: number;
  photo_reports_reassigned: number;
  qr_codes_reassigned: number;
  visits_reassigned: number;
  opening_balances_reassigned: number;
};

export type MergeClientsPreviewResult = {
  keep_client_id: number;
  merge_client_ids: number[];
  orders_to_reassign: number;
  payments_to_reassign: number;
  sales_returns_to_reassign: number;
  equipment_to_reassign: number;
  photo_reports_to_reassign: number;
  qr_codes_to_reassign: number;
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
    qr_codes_to_reassign,
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
    prisma.clientQrCode.count({ where: { tenant_id: tenantId, client_id: { in: uniqueMerge } } }),
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
    qr_codes_to_reassign,
    visits_to_reassign,
    opening_balances_to_reassign,
    total_balance_before: totalBefore.toString(),
    master_balance_before: masterBefore.toString(),
    expected_master_balance_after: totalBefore.toString(),
    conflict_summary: { safe, warning, critical }
  };
}

export async function mergeClientsIntoOne(
  tenantId: number,
  keepClientId: number,
  mergeClientIds: number[],
  actorUserId?: number | null
): Promise<MergeClientsResult> {
  const uniqueMerge = [...new Set(mergeClientIds)].filter((id) => id !== keepClientId);
  if (uniqueMerge.length === 0) {
    throw new Error("NO_MERGE_TARGETS");
  }

  const allIds = [keepClientId, ...uniqueMerge];
  const clients = await prisma.client.findMany({
    where: { id: { in: allIds }, tenant_id: tenantId },
    select: { id: true, merged_into_client_id: true, is_active: true }
  });
  if (clients.length !== allIds.length) {
    throw new Error("NOT_FOUND");
  }
  for (const c of clients) {
    if (c.merged_into_client_id != null) {
      throw new Error("ALREADY_MERGED");
    }
  }

  const stats = await prisma.$transaction(async (tx) => {
    await consolidateClientBalancesForMerge(tx, tenantId, keepClientId, uniqueMerge);

    const payments_reassigned = (
      await tx.payment.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    const sales_returns_reassigned = (
      await tx.salesReturn.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    const equipment_reassigned = (
      await tx.clientEquipment.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    const photo_reports_reassigned = (
      await tx.clientPhotoReport.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    const qr_codes_reassigned = (
      await tx.clientQrCode.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    const visits_reassigned = (
      await tx.agentVisit.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    const opening_balances_reassigned = (
      await tx.clientOpeningBalanceEntry.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    await reassignAgentAssignmentsForMerge(tx, tenantId, keepClientId, uniqueMerge);

    const rules = await tx.bonusRule.findMany({
      where: { tenant_id: tenantId, selected_client_ids: { hasSome: uniqueMerge } }
    });
    if (rules.length > 0) {
      const updates = rules.map((br) => {
        const next = Array.from(
          new Set(
            br.selected_client_ids.map((id) =>
              br.selected_client_ids.includes(id) && uniqueMerge.includes(id) ? keepClientId : id
            )
          )
        );
        return { id: br.id, selected_client_ids: next };
      });
      await Promise.all(
        updates.map((u) =>
          tx.bonusRule.update({ where: { id: u.id }, data: { selected_client_ids: u.selected_client_ids } })
        )
      );
    }

    const orders_reassigned = (
      await tx.order.updateMany({
        where: { tenant_id: tenantId, client_id: { in: uniqueMerge } },
        data: { client_id: keepClientId }
      })
    ).count;

    await tx.client.updateMany({
      where: { id: { in: uniqueMerge }, tenant_id: tenantId },
      data: {
        is_active: false,
        merged_into_client_id: keepClientId
      }
    });

    for (const mid of uniqueMerge) {
      await tx.clientMergeLog.create({
        data: {
          tenant_id: tenantId,
          master_client_id: keepClientId,
          merged_client_id: mid,
          merged_by_user_id: actorUserId ?? null,
          payload: { merge_client_ids: uniqueMerge }
        }
      });
    }

    return {
      orders_reassigned,
      payments_reassigned,
      sales_returns_reassigned,
      equipment_reassigned,
      photo_reports_reassigned,
      qr_codes_reassigned,
      visits_reassigned,
      opening_balances_reassigned
    };
  });

  await appendClientAuditLog(tenantId, keepClientId, actorUserId, "client.merge", {
    merged_client_ids: uniqueMerge,
    ...stats
  });

  return {
    kept: keepClientId,
    merged: uniqueMerge,
    ...stats
  };
}
