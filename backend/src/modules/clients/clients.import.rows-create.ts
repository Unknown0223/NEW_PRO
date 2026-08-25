import { prisma } from "../../config/database";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { buildDuplicateCompositeKey, duplicateKeyFromExistingRow } from "./client-import-masks";
import { replaceClientAgentAssignments } from "./clients.agent-assignments";
import { appendClientAuditLogsBatch } from "./clients.audit";
import {
  buildAgentAssignmentPatchesFromImportRow,
  classifyImportClientDbId,
  colMapHasAgentSlots,
  type ImportStaffLookup
} from "./clients.import.assign";
import {
  loadImportExplicitIdConflicts,
  syncClientsIdSequence
} from "./clients.import.id-lookup";
import { buildImportCreateRowScalar } from "./clients.import.rows-create.build";
import { readArrayCell } from "./clients.import.parse";
import type { ImportFlowContext } from "./clients.import.runtime";
import {
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_ERRORS_RETURNED,
  reportImportRowProgress
} from "./clients.import.runtime";

export async function importClientDataRows(
  tenantId: number,
  rows: unknown[][],
  headerRowIdx: number,
  colIndexByKey: Record<string, number>,
  sheetLabel: string,
  refResolver: ClientImportRefResolver,
  staffLookup: ImportStaffLookup,
  ctx: ImportFlowContext,
  duplicateKeyFields: string[]
): Promise<{
  created: number;
  updated: number;
  errors: string[];
  skippedDuplicate: number;
  skippedEmpty: number;
}> {
  const errors: string[] = [];
  let totalRowErrors = 0;
  const pushErr = (msg: string) => {
    totalRowErrors += 1;
    if (errors.length < IMPORT_MAX_ERRORS_RETURNED) errors.push(msg);
  };

  let created = 0;
  let updated = 0;
  let skippedEmpty = 0;
  let skippedDuplicate = 0;
  const createdIds: number[] = [];
  const updatedIds: number[] = [];
  const hasAgentSlots = colMapHasAgentSlots(colIndexByKey);
  const hasIdCol = Object.prototype.hasOwnProperty.call(colIndexByKey, "client_db_id");

  const firstDataRow = headerRowIdx + 1;
  const lastRowIdx = Math.min(rows.length - 1, headerRowIdx + IMPORT_MAX_DATA_ROWS);

  if (firstDataRow > rows.length - 1) {
    return {
      created: 0,
      updated: 0,
      errors: [
        `Sarlavha ${headerRowIdx + 1}-qatorda («${sheetLabel}»), lekin undan keyin ma’lumot qatori yo‘q.`
      ],
      skippedDuplicate: 0,
      skippedEmpty: 0
    };
  }

  const existingClients = await prisma.client.findMany({
    where: { tenant_id: tenantId, merged_into_client_id: null },
    select: {
      id: true,
      name: true,
      phone_normalized: true,
      client_code: true,
      client_pinfl: true,
      inn: true,
      city: true
    }
  });
  const existingById = new Map(existingClients.map((c) => [c.id, c]));
  const seenDuplicateKeys = new Set<string>();
  for (const c of existingClients) {
    const k = duplicateKeyFromExistingRow(c, duplicateKeyFields);
    if (k) seenDuplicateKeys.add(k);
  }

  const { foreignIdSet, mergedIdSet } = await loadImportExplicitIdConflicts(
    tenantId,
    rows,
    firstDataRow,
    lastRowIdx,
    colIndexByKey
  );

  console.info(
    `[clients import/create] tenant=${tenantId} sheet="${sheetLabel}" fileRows=${rows.length} headerRow=${headerRowIdx + 1} estDataRows=${ctx.totalRows} mappedKeys=${Object.keys(colIndexByKey).length} existingInDb=${existingClients.length} duplicateKeys=${duplicateKeyFields.join(",")} idCol=${hasIdCol}`
  );

  const BATCH_SIZE = 50;
  const seenExplicitIds = new Set<number>();
  let createdWithExplicitId = false;
  const writeStarted = Date.now();

  for (let batchStart = firstDataRow; batchStart <= lastRowIdx; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, lastRowIdx + 1);
    const batchRows = rows.slice(batchStart, batchEnd);
    const batchDuplicateKeys: string[] = [];

    try {
      const batchCreatedIds: number[] = [];
      const batchUpdatedIds: number[] = [];
      await prisma.$transaction(async (tx) => {
        for (let bi = 0; bi < batchRows.length; bi++) {
          const row = batchRows[bi]!;
          const excelRow = batchStart + bi + 1;

          const nameRaw = readArrayCell(row, colIndexByKey.name);
          if (nameRaw == null) {
            skippedEmpty += 1;
            continue;
          }

          let explicitId: number | null = null;
          if (hasIdCol) {
            const idParse = classifyImportClientDbId(readArrayCell(row, colIndexByKey.client_db_id));
            if (idParse.kind === "invalid") {
              pushErr(`Qator ${excelRow}: noto‘g‘ri id — ${idParse.detail}`);
              continue;
            }
            if (idParse.kind === "ok") {
              if (foreignIdSet.has(idParse.id)) {
                pushErr(
                  `Qator ${excelRow}: id=${idParse.id} boshqa tenantga tegishli — cross-tenant id taqiqlangan.`
                );
                continue;
              }
              if (mergedIdSet.has(idParse.id)) {
                pushErr(
                  `Qator ${excelRow}: id=${idParse.id} birlashtirilgan mijoz — import qilinmaydi.`
                );
                continue;
              }
              if (seenExplicitIds.has(idParse.id)) {
                pushErr(`Qator ${excelRow}: id=${idParse.id} faylda takrorlanmoqda.`);
                continue;
              }
              seenExplicitIds.add(idParse.id);
              explicitId = idParse.id;
            }
          }

          const nameTrimmed = nameRaw.trim();
          const built = buildImportCreateRowScalar(nameTrimmed, row, colIndexByKey, refResolver);
          const {
            scalarData,
            client_code,
            client_pinfl,
            inn,
            city,
            phoneNormalized,
            cityNorm
          } = built;
          const existingForId = explicitId != null ? existingById.get(explicitId) : undefined;
          const isUpsertUpdate = existingForId != null;

          if (!isUpsertUpdate) {
            const dupKey = buildDuplicateCompositeKey(duplicateKeyFields, {
              client_code,
              client_pinfl,
              inn,
              nameLower: nameTrimmed.toLocaleLowerCase("ru-RU"),
              phoneDigits: phoneNormalized?.replace(/\D/g, "") ?? null,
              cityNorm
            });
            if (dupKey != null && seenDuplicateKeys.has(dupKey)) {
              skippedDuplicate += 1;
              continue;
            }
            if (dupKey) batchDuplicateKeys.push(dupKey);
          }

          const assignOutcome = hasAgentSlots
            ? buildAgentAssignmentPatchesFromImportRow(
                row,
                colIndexByKey,
                staffLookup,
                excelRow,
                ctx.warnings.push
              )
            : { createPatches: [], updatePatches: [], touched: false };
          const agentPatches = assignOutcome.createPatches;

          if (isUpsertUpdate && explicitId != null) {
            await tx.client.update({ where: { id: explicitId }, data: scalarData });
            if (agentPatches.length > 0) {
              await replaceClientAgentAssignments(tx, tenantId, explicitId, agentPatches, {
                skipStaffDbValidation: true
              });
            }
            batchUpdatedIds.push(explicitId);
            updated += 1;
            ctx.processedRows += 1;
            continue;
          }

          const client = await tx.client.create({
            data: {
              ...(explicitId != null ? { id: explicitId } : {}),
              tenant_id: tenantId,
              ...scalarData
            }
          });

          if (explicitId != null) {
            createdWithExplicitId = true;
            existingById.set(client.id, {
              id: client.id,
              name: nameTrimmed,
              phone_normalized: phoneNormalized,
              client_code,
              client_pinfl,
              inn,
              city
            });
          }

          if (agentPatches.length > 0) {
            await replaceClientAgentAssignments(tx, tenantId, client.id, agentPatches, {
              skipStaffDbValidation: true
            });
          }

          batchCreatedIds.push(client.id);
          created += 1;
          ctx.processedRows += 1;
        }

        if (createdWithExplicitId) {
          await syncClientsIdSequence(tx);
          createdWithExplicitId = false;
        }
      });

      createdIds.push(...batchCreatedIds);
      updatedIds.push(...batchUpdatedIds);
      for (const k of batchDuplicateKeys) seenDuplicateKeys.add(k);
      await reportImportRowProgress(ctx, "writing");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "xato";
      const hint =
        raw.includes("Unique constraint") || raw.includes("unique constraint")
          ? " (ehtimol id yoki noyob maydon boshqa yozuvda band)"
          : "";
      pushErr(`Batch ${batchStart + 1}-${batchEnd}: ${raw.slice(0, 200)}${hint}`);
      ctx.processedRows += batchRows.length;
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

  const out = [...errors];
  if (created === 0 && updated === 0 && errors.length === 0 && skippedEmpty > 0) {
    out.push(
      `Hech kim qo‘shilmadi: Excel ${headerRowIdx + 2}–${rows.length} qatorlarda «name» bo‘sh yoki --- (${skippedEmpty} qator o‘tkazildi).`
    );
  }
  if (skippedDuplicate > 0) {
    out.push(
      `Dublikat klientlar o‘tkazib yuborildi: ${skippedDuplicate} qator (kalit maydonlar: ${duplicateKeyFields.join(", ")}).`
    );
  }
  if (totalRowErrors > IMPORT_MAX_ERRORS_RETURNED) {
    out.push(
      `… va yana ${totalRowErrors - IMPORT_MAX_ERRORS_RETURNED} ta qator xatosi (faqat birinchi ${IMPORT_MAX_ERRORS_RETURNED} matn qaytarildi).`
    );
  }
  for (const line of refResolver.summarizeMisses()) out.push(line);

  return { created, updated, errors: out, skippedDuplicate, skippedEmpty };
}
