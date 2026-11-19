import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { appendTenantAuditEvent } from "../../../lib/tenant-audit";
import { loadActiveWorkSlotsByUserIds } from "../../work-slots/work-slots.query.read";
import type { ApplyProposalBody } from "./proposals.schema";

/**
 * Tayyor qatorlarni maqsad oyidagi draft SalesKpiPlanTarget.cost ga yozadi.
 * approved / pending_approval overwrite qilinmaydi.
 */
export async function applyProposal(
  tenantId: number,
  proposalId: number,
  body: ApplyProposalBody,
  actorUserId: number | null
) {
  const proposal = await prisma.salesPlanProposal.findFirst({
    where: { id: proposalId, tenant_id: tenantId },
    include: { rows: true }
  });
  if (!proposal) throw new Error("NOT_FOUND");
  if (proposal.version !== body.version) throw new Error("VERSION_CONFLICT");
  if (proposal.idempotency_key && body.idempotency_key === proposal.idempotency_key && proposal.status === "applied") {
    return { proposal, applied: 0, skipped: 0, idempotent: true };
  }

  const rows = proposal.rows.filter((r) => {
    if (body.row_ids?.length && !body.row_ids.includes(r.id)) return false;
    return r.ready && !r.excluded && r.proposed_value != null;
  });
  if (!rows.length) throw new Error("NO_READY_ROWS");

  const kpiIds = [...new Set(rows.map((r) => r.kpi_group_id))];
  let applied = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const kpiGroupId of kpiIds) {
      let plan = await tx.salesKpiPlan.findUnique({
        where: {
          tenant_id_month_year_trade_direction_id_kpi_group_id: {
            tenant_id: tenantId,
            month: proposal.target_month,
            year: proposal.target_year,
            trade_direction_id: proposal.trade_direction_id,
            kpi_group_id: kpiGroupId
          }
        }
      });

      if (!plan) {
        plan = await tx.salesKpiPlan.create({
          data: {
            tenant_id: tenantId,
            month: proposal.target_month,
            year: proposal.target_year,
            trade_direction_id: proposal.trade_direction_id,
            kpi_group_id: kpiGroupId,
            status: "draft",
            created_by: actorUserId ?? undefined
          }
        });
      } else if (plan.status === "approved" || plan.status === "pending_approval") {
        skipped += rows.filter((r) => r.kpi_group_id === kpiGroupId).length;
        continue;
      }

      const kpiRows = rows.filter((r) => r.kpi_group_id === kpiGroupId);
      const userIds = kpiRows.map((r) => r.user_id);
      const slots = await loadActiveWorkSlotsByUserIds(userIds);

      for (const r of kpiRows) {
        const existing = await tx.salesKpiPlanTarget.findUnique({
          where: { plan_id_user_id: { plan_id: plan.id, user_id: r.user_id } }
        });
        if (existing && (existing.status === "approved" || existing.status === "pending_approval")) {
          skipped += 1;
          continue;
        }
        const cost = r.proposed_value as Prisma.Decimal;
        if (existing) {
          await tx.salesKpiPlanTarget.update({
            where: { id: existing.id },
            data: {
              cost,
              status: "draft",
              updated_by: actorUserId ?? undefined,
              work_slot_id: r.work_slot_id ?? slots.get(r.user_id)?.slot_id ?? existing.work_slot_id
            }
          });
        } else {
          await tx.salesKpiPlanTarget.create({
            data: {
              tenant_id: tenantId,
              plan_id: plan.id,
              user_id: r.user_id,
              cost,
              status: "draft",
              updated_by: actorUserId ?? undefined,
              work_slot_id: r.work_slot_id ?? slots.get(r.user_id)?.slot_id ?? null
            }
          });
        }
        applied += 1;
      }
    }

    await tx.salesPlanProposal.update({
      where: { id: proposalId },
      data: {
        status: "applied",
        version: proposal.version + 1,
        applied_at: new Date(),
        applied_by: actorUserId,
        idempotency_key: body.idempotency_key ?? proposal.idempotency_key,
        updated_by: actorUserId
      }
    });
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "sales_plan_proposal",
    entityId: proposalId,
    action: "plan_proposal.apply",
    payload: { applied, skipped, version: body.version }
  });

  const updated = await prisma.salesPlanProposal.findUniqueOrThrow({
    where: { id: proposalId },
    include: { rows: true }
  });
  return { proposal: updated, applied, skipped, idempotent: false };
}
