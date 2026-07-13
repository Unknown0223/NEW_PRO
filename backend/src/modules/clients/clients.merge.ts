import { prisma } from "../../config/database";
import { appendClientAuditLog, appendClientAuditLogsBatch } from "./clients.audit";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import {
  CLIENT_MERGE_CONSEQUENCES,
  CLIENT_MERGE_IRREVERSIBLE
} from "./clients.merge.constants";
import {
  consolidateClientBalancesForMerge,
  reassignAgentAssignmentsForMerge
} from "./clients.merge.internals";

export type { MergeClientsPreviewResult } from "./clients.merge.preview";
export { previewMergeClients } from "./clients.merge.preview";

export type MergeClientsResult = {
  kept: number;
  merged: number[];
  orders_reassigned: number;
  payments_reassigned: number;
  sales_returns_reassigned: number;
  equipment_reassigned: number;
  photo_reports_reassigned: number;
  visits_reassigned: number;
  opening_balances_reassigned: number;
  agent_assignments_reassigned: number;
  agent_assignments_dropped_duplicate_slot: number;
  merge_log_ids: number[];
  irreversible: true;
  consequences: readonly string[];
};

type PerMergedClientCounts = {
  client_id: number;
  orders: number;
  payments: number;
  sales_returns: number;
  equipment: number;
  photo_reports: number;
  visits: number;
  opening_balances: number;
};

async function loadPerMergedClientCounts(
  tenantId: number,
  mergeIds: number[]
): Promise<PerMergedClientCounts[]> {
  return Promise.all(
    mergeIds.map(async (client_id) => {
      const [orders, payments, sales_returns, equipment, photo_reports, visits, opening_balances] =
        await Promise.all([
          prisma.order.count({ where: { tenant_id: tenantId, client_id } }),
          prisma.payment.count({ where: { tenant_id: tenantId, client_id } }),
          prisma.salesReturn.count({ where: { tenant_id: tenantId, client_id } }),
          prisma.clientEquipment.count({ where: { tenant_id: tenantId, client_id } }),
          prisma.clientPhotoReport.count({ where: { tenant_id: tenantId, client_id } }),
          prisma.agentVisit.count({ where: { tenant_id: tenantId, client_id } }),
          prisma.clientOpeningBalanceEntry.count({ where: { tenant_id: tenantId, client_id } })
        ]);
      return {
        client_id,
        orders,
        payments,
        sales_returns,
        equipment,
        photo_reports,
        visits,
        opening_balances
      };
    })
  );
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

  const balancesBefore = await prisma.clientBalance.findMany({
    where: { tenant_id: tenantId, client_id: { in: allIds } },
    select: { client_id: true, balance: true }
  });
  const balance_before_by_client: Record<string, string> = {};
  for (const b of balancesBefore) {
    balance_before_by_client[String(b.client_id)] = b.balance.toString();
  }

  const per_merged_client = await loadPerMergedClientCounts(tenantId, uniqueMerge);

  const { stats, merge_log_ids } = await prisma.$transaction(async (tx) => {
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

    const agentStats = await reassignAgentAssignmentsForMerge(tx, tenantId, keepClientId, uniqueMerge);

    const rules = await tx.bonusRule.findMany({
      where: { tenant_id: tenantId, selected_client_ids: { hasSome: uniqueMerge } }
    });
    const bonus_rules_updated = rules.length;
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

    const aggregatePayload = {
      master_client_id: keepClientId,
      merged_client_ids: uniqueMerge,
      orders_reassigned,
      payments_reassigned,
      sales_returns_reassigned,
      equipment_reassigned,
      photo_reports_reassigned,
      visits_reassigned,
      opening_balances_reassigned,
      ...agentStats,
      bonus_rules_updated,
      balance_before_by_client,
      irreversible: CLIENT_MERGE_IRREVERSIBLE,
      consequences: [...CLIENT_MERGE_CONSEQUENCES]
    };

    const merge_log_ids: number[] = [];
    for (const mid of uniqueMerge) {
      const per = per_merged_client.find((x) => x.client_id === mid);
      const row = await tx.clientMergeLog.create({
        data: {
          tenant_id: tenantId,
          master_client_id: keepClientId,
          merged_client_id: mid,
          merged_by_user_id: actorUserId ?? null,
          payload: {
            ...aggregatePayload,
            merged_client_id: mid,
            source_counts: per ?? null
          }
        }
      });
      merge_log_ids.push(row.id);
    }

    return {
      stats: {
        orders_reassigned,
        payments_reassigned,
        sales_returns_reassigned,
        equipment_reassigned,
        photo_reports_reassigned,
        visits_reassigned,
        opening_balances_reassigned,
        ...agentStats,
        bonus_rules_updated
      },
      merge_log_ids
    };
  });

  const auditPayload = {
    master_client_id: keepClientId,
    merged_client_ids: uniqueMerge,
    merge_log_ids,
    per_merged_client,
    balance_before_by_client,
    ...stats,
    irreversible: CLIENT_MERGE_IRREVERSIBLE,
    consequences: [...CLIENT_MERGE_CONSEQUENCES]
  };

  await appendClientAuditLog(tenantId, keepClientId, actorUserId, "client.merge", auditPayload);
  await appendClientAuditLogsBatch(tenantId, uniqueMerge, actorUserId, "client.merge", {
    ...auditPayload,
    role: "merged_source"
  });
  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorUserId ?? null,
    entityType: "client_merge",
    entityId: keepClientId,
    action: "client.merge",
    payload: auditPayload
  });

  return {
    kept: keepClientId,
    merged: uniqueMerge,
    orders_reassigned: stats.orders_reassigned,
    payments_reassigned: stats.payments_reassigned,
    sales_returns_reassigned: stats.sales_returns_reassigned,
    equipment_reassigned: stats.equipment_reassigned,
    photo_reports_reassigned: stats.photo_reports_reassigned,
    visits_reassigned: stats.visits_reassigned,
    opening_balances_reassigned: stats.opening_balances_reassigned,
    agent_assignments_reassigned: stats.agent_assignments_reassigned,
    agent_assignments_dropped_duplicate_slot: stats.agent_assignments_dropped_duplicate_slot,
    merge_log_ids,
    irreversible: CLIENT_MERGE_IRREVERSIBLE,
    consequences: CLIENT_MERGE_CONSEQUENCES
  };
}
