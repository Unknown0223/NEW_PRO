import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { loadClientPreviewsMap } from "./client-dedupe.service";
import { appendClientAuditLog } from "./clients.audit";

async function consolidateClientBalancesForMerge(
  tx: Prisma.TransactionClient,
  tenantId: number,
  keepClientId: number,
  mergeIds: number[]
): Promise<void> {
  // OPTIMIZED: Fetch all balances in single query instead of N queries
  const allBalances = await tx.clientBalance.findMany({
    where: {
      tenant_id: tenantId,
      client_id: { in: [keepClientId, ...mergeIds] }
    }
  });

  if (allBalances.length === 0) return;

  const masterBalance = allBalances.find(b => b.client_id === keepClientId);
  const mergeBalances = allBalances.filter(b => mergeIds.includes(b.client_id));

  if (!masterBalance) {
    // No master balance exists, promote first merge balance
    if (mergeBalances.length === 0) return;

    const firstMerge = mergeBalances[0];
    await tx.clientBalance.update({
      where: { id: firstMerge.id },
      data: { client_id: keepClientId }
    });

    // Update remaining merge balances to point to new master
    const remainingMerge = mergeBalances.slice(1);
    if (remainingMerge.length > 0) {
      // Calculate total from remaining
      const totalRemaining = remainingMerge.reduce(
        (sum, b) => sum.plus(b.balance),
        new Prisma.Decimal(0)
      );
      await tx.clientBalanceMovement.updateMany({
        where: { client_balance_id: { in: remainingMerge.map(b => b.id) } },
        data: { client_balance_id: firstMerge.id }
      });
      await tx.clientBalance.update({
        where: { id: firstMerge.id },
        data: { balance: firstMerge.balance.plus(totalRemaining) }
      });
      await tx.clientBalance.deleteMany({
        where: { id: { in: remainingMerge.map(b => b.id) } }
      });
    }
    return;
  }

  // Master balance exists, consolidate all merge balances
  const totalMergeBalance = mergeBalances.reduce(
    (sum, b) => sum.plus(b.balance),
    new Prisma.Decimal(0)
  );
  const combinedBalance = masterBalance.balance.plus(totalMergeBalance);

  // Update master balance
  await tx.clientBalance.update({
    where: { id: masterBalance.id },
    data: { balance: combinedBalance }
  });

  // Update all movements to point to master balance
  if (mergeBalances.length > 0) {
    await tx.clientBalanceMovement.updateMany({
      where: { client_balance_id: { in: mergeBalances.map(b => b.id) } },
      data: { client_balance_id: masterBalance.id }
    });

    // Delete merge balances
    await tx.clientBalance.deleteMany({
      where: { id: { in: mergeBalances.map(b => b.id) } }
    });
  }
}

async function reassignAgentAssignmentsForMerge(
  tx: Prisma.TransactionClient,
  tenantId: number,
  keepClientId: number,
  mergeIds: number[]
): Promise<void> {
  // OPTIMIZED: Fetch all assignments and master slots in single queries
  const rows = await tx.clientAgentAssignment.findMany({
    where: { tenant_id: tenantId, client_id: { in: mergeIds } }
  });

  if (rows.length === 0) return;

  const masterAssignments = await tx.clientAgentAssignment.findMany({
    where: { tenant_id: tenantId, client_id: keepClientId }
  });
  const masterSlots = new Set(masterAssignments.map(a => a.slot));

  // Separate into delete (conflict) and reassign (no conflict)
  const toDelete: number[] = [];
  const toReassign: number[] = [];

  for (const a of rows) {
    if (masterSlots.has(a.slot)) {
      toDelete.push(a.id);
    } else {
      toReassign.push(a.id);
    }
  }

  // Batch operations
  if (toDelete.length > 0) {
    await tx.clientAgentAssignment.deleteMany({
      where: { id: { in: toDelete } }
    });
  }

  if (toReassign.length > 0) {
    await tx.clientAgentAssignment.updateMany({
      where: { id: { in: toReassign } },
      data: { client_id: keepClientId }
    });
  }
}

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

function normalizeMergePreviewCell(v: string | null | undefined): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function mergePreviewConflictLevel(values: Array<string | null | undefined>): "safe" | "warning" | "critical" {
  const normalized = values.map(normalizeMergePreviewCell);
  const meaningful = normalized.filter((v) => v !== "" && v !== "—");
  if (meaningful.length <= 1) return "safe";
  const uniq = new Set(meaningful);
  if (uniq.size === 1) return "safe";
  const anyEmpty = normalized.some((v) => v === "" || v === "—");
  return anyEmpty ? "warning" : "critical";
}

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
    ids.reduce((acc, id) => acc.add(new Prisma.Decimal((balMap.get(id) ?? new Prisma.Decimal(0)).toString())), new Prisma.Decimal(0));
  const totalBefore = sum(allIds);
  const masterBefore = sum([keepClientId]);

  const previews = allIds.map((id) => previewsMap.get(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const conflictFields: Array<(p: NonNullable<typeof previews[number]>) => string | null | undefined> = [
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
    for (const br of rules) {
      const next = Array.from(
        new Set(br.selected_client_ids.map((id) => (uniqueMerge.includes(id) ? keepClientId : id)))
      );
      await tx.bonusRule.update({
        where: { id: br.id },
        data: { selected_client_ids: next }
      });
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
