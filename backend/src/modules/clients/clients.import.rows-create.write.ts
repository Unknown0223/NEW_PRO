import { prisma } from "../../config/database";
import { replaceClientAgentAssignments } from "./clients.agent-assignments";
import { appendClientAuditLogsBatch } from "./clients.audit";
import { syncClientsIdSequence } from "./clients.import.id-lookup";
import type { AgentAssignmentPatch } from "./clients.types";
import type { ImportFlowContext } from "./clients.import.runtime";
import { reportImportRowProgress } from "./clients.import.runtime";

export type PendingImportCreate = {
  kind: "create" | "update";
  excelRow: number;
  explicitId: number | null;
  scalarData: Record<string, unknown>;
  agentPatches: AgentAssignmentPatch[];
  peer: {
    name: string;
    phone_normalized: string | null;
    client_code: string | null;
    client_pinfl: string | null;
    inn: string | null;
    city: string | null;
    latitude: unknown;
    longitude: unknown;
  };
  dupKey: string | null;
};

export async function writePendingImportCreates(
  tenantId: number,
  pending: PendingImportCreate[],
  ctx: ImportFlowContext
): Promise<{ created: number; updated: number; createdIds: number[]; updatedIds: number[]; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  const createdIds: number[] = [];
  const updatedIds: number[] = [];
  const BATCH_SIZE = 50;
  const writeStarted = Date.now();

  for (let batchStart = 0; batchStart < pending.length; batchStart += BATCH_SIZE) {
    const batch = pending.slice(batchStart, batchStart + BATCH_SIZE);
    const batchCreatedIds: number[] = [];
    const batchUpdatedIds: number[] = [];
    let createdWithExplicitId = false;
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of batch) {
          if (item.kind === "update" && item.explicitId != null) {
            await tx.client.update({
              where: { id: item.explicitId },
              data: item.scalarData as never
            });
            if (item.agentPatches.length > 0) {
              await replaceClientAgentAssignments(tx, tenantId, item.explicitId, item.agentPatches, {
                skipStaffDbValidation: true,
                softPreserveDebtLockedStaff: true
              }).then((res) => {
                for (const b of res.debtBlocks) {
                  ctx.warnings.push(`Строка ${item.excelRow}: ${b.messageRu}`);
                }
              });
            }
            batchUpdatedIds.push(item.explicitId);
            updated += 1;
            ctx.processedRows += 1;
            continue;
          }

          const client = await tx.client.create({
            data: {
              ...(item.explicitId != null ? { id: item.explicitId } : {}),
              tenant_id: tenantId,
              ...(item.scalarData as object)
            } as never
          });
          if (item.explicitId != null) createdWithExplicitId = true;
          if (item.agentPatches.length > 0) {
            await replaceClientAgentAssignments(tx, tenantId, client.id, item.agentPatches, {
              skipStaffDbValidation: true,
              softPreserveDebtLockedStaff: true
            }).then((res) => {
              for (const b of res.debtBlocks) {
                ctx.warnings.push(`Строка ${item.excelRow}: ${b.messageRu}`);
              }
            });
          }
          batchCreatedIds.push(client.id);
          created += 1;
          ctx.processedRows += 1;
        }
        if (createdWithExplicitId) await syncClientsIdSequence(tx);
      });
      createdIds.push(...batchCreatedIds);
      updatedIds.push(...batchUpdatedIds);
      await reportImportRowProgress(ctx, "writing");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "ошибка";
      const hint =
        raw.includes("Unique constraint") || raw.includes("unique constraint")
          ? " (вероятно, id или уникальное поле уже занято другой записью)"
          : "";
      errors.push(
        `Пакет строк ${batch[0]?.excelRow ?? "?"}-${batch[batch.length - 1]?.excelRow ?? "?"}: ${raw.slice(0, 200)}${hint}`
      );
      ctx.processedRows += batch.length;
    }
  }

  ctx.writeMs += Date.now() - writeStarted;

  if (createdIds.length > 0) {
    await appendClientAuditLogsBatch(
      tenantId,
      createdIds,
      ctx.actorUserId ?? null,
      "client.import.create",
      { source: "xlsx_import" }
    );
  }
  if (updatedIds.length > 0) {
    await appendClientAuditLogsBatch(
      tenantId,
      updatedIds,
      ctx.actorUserId ?? null,
      "client.import.patch",
      { source: "xlsx_import_upsert_by_id" }
    );
  }

  return { created, updated, createdIds, updatedIds, errors };
}
