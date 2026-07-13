import { Prisma } from "@prisma/client";

export async function consolidateClientBalancesForMerge(
  tx: Prisma.TransactionClient,
  tenantId: number,
  keepClientId: number,
  mergeIds: number[]
): Promise<void> {
  const allBalances = await tx.clientBalance.findMany({
    where: {
      tenant_id: tenantId,
      client_id: { in: [keepClientId, ...mergeIds] }
    }
  });

  if (allBalances.length === 0) return;

  const masterBalance = allBalances.find((b) => b.client_id === keepClientId);
  const mergeBalances = allBalances.filter((b) => mergeIds.includes(b.client_id));

  if (!masterBalance) {
    if (mergeBalances.length === 0) return;

    const firstMerge = mergeBalances[0];
    const remainingMerge = mergeBalances.slice(1);

    if (remainingMerge.length > 0) {
      await tx.clientBalanceMovement.updateMany({
        where: { client_balance_id: { in: remainingMerge.map((b) => b.id) } },
        data: { client_balance_id: firstMerge.id }
      });
    }

    await tx.clientBalance.update({
      where: { id: firstMerge.id },
      data: { client_id: keepClientId }
    });

    const totalRemaining = remainingMerge.reduce(
      (sum, b) => sum.plus(b.balance),
      new Prisma.Decimal(0)
    );

    await tx.clientBalance.update({
      where: { id: firstMerge.id },
      data: { balance: firstMerge.balance.plus(totalRemaining) }
    });

    if (remainingMerge.length > 0) {
      await tx.clientBalance.deleteMany({
        where: { id: { in: remainingMerge.map((b) => b.id) } }
      });
    }
    return;
  }

  const totalMergeBalance = mergeBalances.reduce(
    (sum, b) => sum.plus(b.balance),
    new Prisma.Decimal(0)
  );
  const combinedBalance = masterBalance.balance.plus(totalMergeBalance);

  await tx.clientBalance.update({
    where: { id: masterBalance.id },
    data: { balance: combinedBalance }
  });

  if (mergeBalances.length > 0) {
    await tx.clientBalanceMovement.updateMany({
      where: { client_balance_id: { in: mergeBalances.map((b) => b.id) } },
      data: { client_balance_id: masterBalance.id }
    });

    await tx.clientBalance.deleteMany({
      where: { id: { in: mergeBalances.map((b) => b.id) } }
    });
  }
}

export type AgentAssignmentMergeStats = {
  agent_assignments_reassigned: number;
  agent_assignments_dropped_duplicate_slot: number;
};

export async function reassignAgentAssignmentsForMerge(
  tx: Prisma.TransactionClient,
  tenantId: number,
  keepClientId: number,
  mergeIds: number[]
): Promise<AgentAssignmentMergeStats> {
  const empty: AgentAssignmentMergeStats = {
    agent_assignments_reassigned: 0,
    agent_assignments_dropped_duplicate_slot: 0
  };
  const rows = await tx.clientAgentAssignment.findMany({
    where: { tenant_id: tenantId, client_id: { in: mergeIds } }
  });

  if (rows.length === 0) return empty;

  const masterAssignments = await tx.clientAgentAssignment.findMany({
    where: { tenant_id: tenantId, client_id: keepClientId }
  });
  const masterSlots = new Set(masterAssignments.map((a) => a.slot));

  const toDelete: number[] = [];
  const toReassign: number[] = [];

  for (const a of rows) {
    if (masterSlots.has(a.slot)) {
      toDelete.push(a.id);
    } else {
      toReassign.push(a.id);
    }
  }

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

  return {
    agent_assignments_reassigned: toReassign.length,
    agent_assignments_dropped_duplicate_slot: toDelete.length
  };
}

export function normalizeMergePreviewCell(v: string | null | undefined): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function mergePreviewConflictLevel(
  values: Array<string | null | undefined>
): "safe" | "warning" | "critical" {
  const normalized = values.map(normalizeMergePreviewCell);
  const meaningful = normalized.filter((v) => v !== "" && v !== "—");
  if (meaningful.length <= 1) return "safe";
  const uniq = new Set(meaningful);
  if (uniq.size === 1) return "safe";
  const anyEmpty = normalized.some((v) => v === "" || v === "—");
  return anyEmpty ? "warning" : "critical";
}
