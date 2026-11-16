import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";
import { calculateProposalLive } from "./proposals.calculate";
import { tiyinToSomString } from "./proposals.money";
import type { PatchProposalBody, SaveProposalBody } from "./proposals.schema";

function decOrNull(tiyin: string | null | undefined): Prisma.Decimal | null {
  const som = tiyinToSomString(tiyin ?? null);
  if (som == null) return null;
  return new Prisma.Decimal(som);
}

export async function getProposalById(tenantId: number, id: number) {
  const row = await prisma.salesPlanProposal.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      rows: { orderBy: [{ kpi_group_id: "asc" }, { user_id: "asc" }] },
      trade_direction: { select: { id: true, name: true, code: true } }
    }
  });
  if (!row) throw new Error("NOT_FOUND");
  return row;
}

export async function findProposalForPeriod(
  tenantId: number,
  directionId: number,
  targetYear: number,
  targetMonth: number,
  metric = "cost"
) {
  return prisma.salesPlanProposal.findUnique({
    where: {
      tenant_id_trade_direction_id_target_year_target_month_metric: {
        tenant_id: tenantId,
        trade_direction_id: directionId,
        target_year: targetYear,
        target_month: targetMonth,
        metric
      }
    },
    include: { rows: true }
  });
}

async function replaceRows(
  tx: Prisma.TransactionClient,
  tenantId: number,
  proposalId: number,
  rows: NonNullable<SaveProposalBody["rows"]>
) {
  await tx.salesPlanProposalRow.deleteMany({ where: { proposal_id: proposalId } });
  if (!rows.length) return;
  await tx.salesPlanProposalRow.createMany({
    data: rows.map((r) => ({
      tenant_id: tenantId,
      proposal_id: proposalId,
      user_id: r.user_id,
      work_slot_id: r.work_slot_id ?? null,
      kpi_group_id: r.kpi_group_id,
      source_fact: decOrNull(r.source_fact),
      source_plan: decOrNull(r.source_plan),
      base_value: decOrNull(r.base_value),
      proposed_value: decOrNull(r.proposed_value),
      manual_value: decOrNull(r.manual_value),
      manual_reason: r.manual_reason ?? null,
      excluded: r.excluded ?? false,
      ready: r.ready ?? false,
      issues: (r.issues ?? []) as Prisma.InputJsonValue,
      resolved_rule: (r.resolved_rule ?? Prisma.JsonNull) as Prisma.InputJsonValue
    }))
  });
}

function rowsFromCalculate(
  calc: Awaited<ReturnType<typeof calculateProposalLive>>
): NonNullable<SaveProposalBody["rows"]> {
  const out: NonNullable<SaveProposalBody["rows"]> = [];
  for (const k of calc.result.kpis) {
    for (const row of k.result.rows) {
      const prev = row.employee.previousPlan;
      out.push({
        user_id: row.employee.employeeId,
        work_slot_id: row.employee.workSlotId,
        kpi_group_id: k.kpiGroupId,
        source_fact: row.employee.fact?.net ?? null,
        source_plan: prev && prev.status !== "missing" ? prev.value : null,
        base_value: row.base,
        proposed_value: row.value,
        manual_value: row.origin === "manual" ? row.value : null,
        manual_reason: null,
        excluded: row.origin === "excluded",
        ready: row.ready,
        issues: row.issues,
        resolved_rule: {
          formula: row.formula,
          ruleId: row.ruleId,
          ruleName: row.ruleName,
          origin: row.origin
        }
      });
    }

  }
  return out;
}


export async function upsertProposal(
  tenantId: number,
  body: SaveProposalBody,
  actorUserId: number | null
) {
  const calc = await calculateProposalLive(tenantId, {
    direction_id: body.direction_id,
    target: body.target,
    source: body.source,
    configs: body.configs
  });
  const rows = body.rows?.length ? body.rows : rowsFromCalculate(calc);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.salesPlanProposal.findUnique({
      where: {
        tenant_id_trade_direction_id_target_year_target_month_metric: {
          tenant_id: tenantId,
          trade_direction_id: body.direction_id,
          target_year: body.target.year,
          target_month: body.target.month,
          metric: "cost"
        }
      }
    });

    const data = {
      source_year: body.source.year,
      source_month: body.source.month,
      config: body.configs as Prisma.InputJsonValue,
      snapshot_hash: calc.context.snapshot_hash,
      name: body.name ?? null,
      status: "draft" as const,
      updated_by: actorUserId,
      idempotency_key: body.idempotency_key ?? null,
      applied_at: null,
      applied_by: null
    };

    const proposal = existing
      ? await tx.salesPlanProposal.update({
          where: { id: existing.id },
          data: { ...data, version: existing.version + 1 }
        })
      : await tx.salesPlanProposal.create({
          data: {
            tenant_id: tenantId,
            trade_direction_id: body.direction_id,
            target_year: body.target.year,
            target_month: body.target.month,
            metric: "cost",
            created_by: actorUserId,
            version: 1,
            ...data
          }
        });

    await replaceRows(tx, tenantId, proposal.id, rows);
    return tx.salesPlanProposal.findUniqueOrThrow({
      where: { id: proposal.id },
      include: { rows: true }
    });
  });
}

export async function patchProposal(
  tenantId: number,
  id: number,
  body: PatchProposalBody,
  actorUserId: number | null
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.salesPlanProposal.findFirst({
      where: { id, tenant_id: tenantId }
    });
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.version !== body.version) throw new Error("VERSION_CONFLICT");

    const source = body.source ?? {
      year: existing.source_year,
      month: existing.source_month
    };
    const configs = (body.configs ?? existing.config) as SaveProposalBody["configs"];

    let snapshot_hash = existing.snapshot_hash;
    let rows = body.rows;
    if (body.configs || body.source) {
      const calc = await calculateProposalLive(tenantId, {
        direction_id: existing.trade_direction_id,
        target: { year: existing.target_year, month: existing.target_month },
        source,
        configs
      });
      snapshot_hash = calc.context.snapshot_hash;
      if (!rows?.length) rows = rowsFromCalculate(calc);
    }

    await tx.salesPlanProposal.update({
      where: { id },
      data: {
        version: existing.version + 1,
        source_year: source.year,
        source_month: source.month,
        config: configs as Prisma.InputJsonValue,
        snapshot_hash,
        name: body.name === undefined ? undefined : body.name,
        status: body.status ?? "draft",
        updated_by: actorUserId
      }
    });
    if (rows) await replaceRows(tx, tenantId, id, rows);
    return tx.salesPlanProposal.findUniqueOrThrow({
      where: { id },
      include: { rows: true }
    });
  });
}
