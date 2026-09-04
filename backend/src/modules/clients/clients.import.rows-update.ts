import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { applyTerritoryAutoAssignAfterAddressChange, clientUpdateTouchesAddress } from "../work-slots/work-slots.territory-auto";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { filterClientUpdateInputByApplyFields } from "./client-import-masks";
import { normalizePhoneDigits } from "./clients.types";
import { CONTACT_SLOTS, IMPORT_CONTACT_PERSON_SLOTS, contactPersonsToJson } from "./clients.helpers";
import { replaceClientAgentAssignments } from "./clients.agent-assignments";
import { appendClientAuditLogsBatch } from "./clients.audit";
import {
  buildAgentAssignmentPatchesFromImportRow,
  colMapHasAgentSlots,
  type ImportStaffLookup
} from "./clients.import.assign";
import { classifyFlexibleImportId, MAX_CLIENT_CODE_ID_LEN } from "./clients.import.flexible-id";
import { filterImportAgentPatchesByWorkSlot } from "./clients.import.agent-slot-gate";
import { findImportUpdateUniqueConflicts } from "./clients.import.update-uniques";
import {
  isPlaceholderCell,
  parseCreditLimit,
  parseIsActive,
  parseOptionalDate,
  parseOptionalLatitudeImport,
  parseOptionalLongitudeImport,
  readArrayCell,
  readImportRefCell,
  trimImportClientCode,
  trimImportPinfl
} from "./clients.import.parse";
import {
  filterUnchangedImportScalarData,
  importAssignmentsEqual,
  importColPresent,
  normalizeExistingImportAssignments,
  normalizeIncomingImportAssignments,
  type ExistingImportAssignmentRow
} from "./clients.import.scalar";
import type { ImportFlowContext } from "./clients.import.runtime";
import {
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_ERRORS_RETURNED,
  humanizeImportDbError,
  reportImportRowProgress
} from "./clients.import.runtime";
import {
  fetchImportExistingAssignments,
  fetchImportExistingClients,
  fetchImportExistingClientsByCodes
} from "./clients.import.id-lookup";
import type { ContactPersonSlot } from "./clients.types";

import { buildImportUpdateScalarData } from "./clients.import.rows-update.build";

export async function importClientUpdateRows(
  tenantId: number,
  rows: unknown[][],
  headerRowIdx: number,
  colIndexByKey: Record<string, number>,
  sheetLabel: string,
  refResolver: ClientImportRefResolver,
  staffLookup: ImportStaffLookup,
  ctx: ImportFlowContext,
  updateApplyFields: string[] | null
): Promise<{ updated: number; errors: string[]; skippedEmpty: number; unchangedRows: number }> {
  const errors: string[] = [];
  let totalRowErrors = 0;
  const pushErr = (msg: string) => {
    totalRowErrors += 1;
    if (errors.length < IMPORT_MAX_ERRORS_RETURNED) errors.push(msg);
  };

  let updated = 0;
  let skippedEmpty = 0;
  let unchangedRows = 0;
  let skippedDuplicate = 0;

  const firstDataRow = headerRowIdx + 1;
  const lastRowIdx = Math.min(rows.length - 1, headerRowIdx + IMPORT_MAX_DATA_ROWS);

  if (firstDataRow > rows.length - 1) {
    return {
      updated: 0,
      errors: [
        `Sarlavha ${headerRowIdx + 1}-qatorda («${sheetLabel}»), lekin undan keyin ma’lumot qatori yo‘q.`
      ],
      skippedEmpty: 0,
      unchangedRows: 0
    };
  }

  const applySet =
    updateApplyFields != null && updateApplyFields.length > 0 ? new Set(updateApplyFields) : null;
  const hasAgentSlots = colMapHasAgentSlots(colIndexByKey);
  const candidateIds = new Set<number>();
  const candidateCodes = new Set<string>();
  for (let r = firstDataRow; r <= lastRowIdx; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const idParse = classifyFlexibleImportId(readArrayCell(row, colIndexByKey.client_db_id), {
      maxCodeLen: MAX_CLIENT_CODE_ID_LEN,
      label: "ИД"
    });
    if (idParse.kind === "ok_db") candidateIds.add(idParse.id);
    if (idParse.kind === "ok_code") candidateCodes.add(idParse.code);
  }
  const candidateIdList = Array.from(candidateIds);
  const idChunks = Math.max(1, Math.ceil(candidateIdList.length / 50_000));
  console.info(
    `[clients import/update] tenant=${tenantId} sheet="${sheetLabel}" estDataRows=${ctx.totalRows} distinctClientIdsInFile=${candidateIdList.length} codes=${candidateCodes.size} lookupChunks=${idChunks}`
  );

  let existingRows: Awaited<ReturnType<typeof fetchImportExistingClients>> = [];
  try {
    const [byId, byCode] = await Promise.all([
      fetchImportExistingClients(tenantId, candidateIdList),
      fetchImportExistingClientsByCodes(tenantId, Array.from(candidateCodes))
    ]);
    const merged = new Map<number, (typeof byId)[number]>();
    for (const x of byId) merged.set(x.id, x);
    for (const x of byCode) merged.set(x.id, x);
    existingRows = Array.from(merged.values());
  } catch (e) {
    throw new Error(humanizeImportDbError(e));
  }
  const existingById = new Map(existingRows.map((x) => [x.id, x]));
  const existingByCode = new Map<string, (typeof existingRows)[number]>();
  for (const x of existingRows) {
    const c = x.client_code?.trim();
    if (c) existingByCode.set(c, x);
  }
  const allResolvedIds = existingRows.map((x) => x.id);
  const currentAssignmentsByClientId = new Map<
    number,
    Array<{
      slot: number;
      agent_id: number | null;
      expeditor_user_id: number | null;
      expeditor_phone: string | null;
      visit_weekdays: number[];
    }>
  >();
  if (hasAgentSlots && allResolvedIds.length > 0) {
    let assignmentRows: Awaited<ReturnType<typeof fetchImportExistingAssignments>> = [];
    try {
      assignmentRows = await fetchImportExistingAssignments(tenantId, allResolvedIds);
    } catch (e) {
      throw new Error(humanizeImportDbError(e));
    }
    const grouped = new Map<number, ExistingImportAssignmentRow[]>();
    for (const row of assignmentRows) {
      const list = grouped.get(row.client_id) ?? [];
      list.push({
        slot: row.slot,
        agent_id: row.agent_id,
        expeditor_user_id: row.expeditor_user_id,
        expeditor_phone: row.expeditor_phone,
        visit_weekdays: row.visit_weekdays
      });
      grouped.set(row.client_id, list);
    }
    for (const [clientId, list] of grouped.entries()) {
      currentAssignmentsByClientId.set(clientId, normalizeExistingImportAssignments(list));
    }
  }

  const BATCH_SIZE = 50;
  const bothUpdates: Array<{ idVal: number; nextData: Record<string, unknown>; agentPatches: unknown[] }> = [];
  const scalarOnly: Array<{ idVal: number; nextData: Record<string, unknown> }> = [];
  const assignmentOnly: Array<{ idVal: number; agentPatches: unknown[] }> = [];
  const seenUpdateClientIds = new Set<number>();
  const claimedNames = new Map<string, number>();
  const claimedPhones = new Map<string, number>();
  const claimedCodes = new Map<string, number>();
  const claimedInns = new Map<string, number>();
  const claimedPinfls = new Map<string, number>();

  for (let r = firstDataRow; r <= lastRowIdx; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) {
      skippedEmpty += 1;
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }

    const idParse = classifyFlexibleImportId(readArrayCell(row, colIndexByKey.client_db_id), {
      maxCodeLen: MAX_CLIENT_CODE_ID_LEN,
      label: "ИД"
    });
    if (idParse.kind === "absent") {
      skippedEmpty += 1;
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }
    if (idParse.kind === "invalid") {
      pushErr(`Qator ${r + 1} (Excel): noto‘g‘ri ИД — ${idParse.detail}`);
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }
    let idVal: number | null = null;
    let idLabel = "";
    if (idParse.kind === "ok_db") {
      idVal = idParse.id;
      idLabel = String(idParse.id);
    } else {
      idLabel = idParse.code;
      idVal = existingByCode.get(idParse.code)?.id ?? null;
    }
    if (idVal == null) {
      pushErr(`Qator ${r + 1} (Excel): mijoz topilmadi (ИД=${idLabel}).`);
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }
    if (seenUpdateClientIds.has(idVal)) {
      skippedDuplicate += 1;
      pushErr(`Qator ${r + 1} (Excel): ИД=${idLabel} faylda takrorlanmoqda — ikkinchi qator o‘tkazib yuborildi.`);
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }
    seenUpdateClientIds.add(idVal);

    try {
      const resolveStarted = Date.now();
      let data = buildImportUpdateScalarData(row, colIndexByKey, refResolver, applySet);
      const assignOutcome = hasAgentSlots
        ? buildAgentAssignmentPatchesFromImportRow(
            row,
            colIndexByKey,
            staffLookup,
            r + 1,
            ctx.warnings.push,
            currentAssignmentsByClientId.get(idVal) ?? [],
            applySet
          )
        : { createPatches: [], updatePatches: [], touched: false };
      let agentPatches = await filterImportAgentPatchesByWorkSlot(
        tenantId,
        assignOutcome.updatePatches,
        { excelRow: r + 1, warn: ctx.warnings.push }
      );
      ctx.resolveMs += Date.now() - resolveStarted;

      const existing = existingById.get(idVal);
      if (!existing) {
        throw new Error(`NOT_FOUND`);
      }
      const nextData = filterUnchangedImportScalarData(data, existing);

      const uniqueConflicts = await findImportUpdateUniqueConflicts(tenantId, idVal, {
        name: nextData.name as string | null | undefined,
        phone: nextData.phone as string | null | undefined,
        phone_normalized: nextData.phone_normalized as string | null | undefined,
        client_code: nextData.client_code as string | null | undefined,
        inn: nextData.inn as string | null | undefined,
        client_pinfl: nextData.client_pinfl as string | null | undefined
      });
      if (uniqueConflicts.length > 0) {
        const c0 = uniqueConflicts[0]!;
        pushErr(
          `Qator ${r + 1} (Excel): dublikat — «${c0.field}»=${c0.value} allaqachon mijoz #${c0.otherClientId} da (ИД=${idLabel}).`
        );
        skippedDuplicate += 1;
        ctx.processedRows += 1;
        await reportImportRowProgress(ctx, "resolving");
        continue;
      }

      /** Fayl ichida bir xil noyob qiymat ikki mijozga yozilmasin */
      const claimOrConflict = (
        map: Map<string, number>,
        raw: unknown,
        fieldLabel: string
      ): boolean => {
        if (raw == null) return false;
        const key = String(raw).trim().toLocaleLowerCase("ru-RU");
        if (!key) return false;
        const prevId = map.get(key);
        if (prevId != null && prevId !== idVal) {
          pushErr(
            `Qator ${r + 1} (Excel): dublikat faylda — «${fieldLabel}»=${String(raw).trim()} allaqachon ИД=${prevId} qatorida.`
          );
          return true;
        }
        map.set(key, idVal!);
        return false;
      };
      if (
        claimOrConflict(claimedNames, nextData.name, "name") ||
        claimOrConflict(claimedPhones, nextData.phone_normalized ?? nextData.phone, "phone") ||
        claimOrConflict(claimedCodes, nextData.client_code, "client_code") ||
        claimOrConflict(claimedInns, nextData.inn, "inn") ||
        claimOrConflict(claimedPinfls, nextData.client_pinfl, "client_pinfl")
      ) {
        skippedDuplicate += 1;
        ctx.processedRows += 1;
        await reportImportRowProgress(ctx, "resolving");
        continue;
      }

      const hasScalars = Object.keys(nextData).length > 0;
      const nextAssignments = normalizeIncomingImportAssignments(agentPatches);
      const currentAssignments = currentAssignmentsByClientId.get(idVal) ?? [];
      const hasAssignmentChange =
        assignOutcome.touched && !importAssignmentsEqual(nextAssignments, currentAssignments);
      if (!hasScalars && !hasAssignmentChange) {
        unchangedRows += 1;
        ctx.processedRows += 1;
        await reportImportRowProgress(ctx, "resolving");
        continue;
      }

      if (hasScalars && hasAssignmentChange) {
        bothUpdates.push({ idVal, nextData, agentPatches });
      } else if (hasScalars) {
        scalarOnly.push({ idVal, nextData });
      } else if (hasAssignmentChange) {
        assignmentOnly.push({ idVal, agentPatches });
      }

      if (hasAssignmentChange) {
        currentAssignmentsByClientId.set(idVal, nextAssignments);
      }
      const rowChanged = hasScalars || hasAssignmentChange;
      if (rowChanged) {
        updated += 1;
      }
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "resolving");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "xato";
      if (raw === "NOT_FOUND") {
        pushErr(`Qator ${r + 1} (Excel): mijoz topilmadi yoki birlashtirilgan (ИД=${idLabel}).`);
      } else {
        const short =
          raw.includes("Unique constraint") || raw.includes("unique constraint")
            ? "noyob maydon takrorlanmoqda"
            : raw.length > 180
              ? `${raw.slice(0, 180)}…`
              : raw;
        pushErr(`Qator ${r + 1} (Excel): ${short}`);
      }
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "resolving");
    }
  }

  const writeStarted = Date.now();
  const processBatch = async (batch: unknown[], fn: (tx: Prisma.TransactionClient, item: unknown) => Promise<void>) => {
    for (let i = 0; i < batch.length; i += BATCH_SIZE) {
      const chunk = batch.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const item of chunk) {
          await fn(tx, item);
        }
      });
    }
  };

  if (bothUpdates.length > 0) {
    await processBatch(bothUpdates, async (tx, item) => {
      const { idVal, nextData, agentPatches } = item as { idVal: number; nextData: Record<string, unknown>; agentPatches: unknown[] };
      await tx.client.update({ where: { id: idVal }, data: nextData });
      await replaceClientAgentAssignments(tx, tenantId, idVal, agentPatches as Parameters<typeof replaceClientAgentAssignments>[3], {
        skipStaffDbValidation: true,
        softPreserveDebtLockedStaff: true
      }).then((res) => {
        for (const b of res.debtBlocks) {
          ctx.warnings.push(`ИД=${idVal}: ${b.messageRu}`);
        }
      });
    });
  }

  if (scalarOnly.length > 0) {
    await processBatch(scalarOnly, async (tx, item) => {
      const { idVal, nextData } = item as { idVal: number; nextData: Record<string, unknown> };
      await tx.client.update({ where: { id: idVal }, data: nextData });
    });
  }

  if (assignmentOnly.length > 0) {
    await processBatch(assignmentOnly, async (tx, item) => {
      const { idVal, agentPatches } = item as { idVal: number; agentPatches: unknown[] };
      await replaceClientAgentAssignments(tx, tenantId, idVal, agentPatches as Parameters<typeof replaceClientAgentAssignments>[3], {
        skipStaffDbValidation: true,
        softPreserveDebtLockedStaff: true
      }).then((res) => {
        for (const b of res.debtBlocks) {
          ctx.warnings.push(`ИД=${idVal}: ${b.messageRu}`);
        }
      });
    });
  }

  ctx.writeMs += Date.now() - writeStarted;

  const updatedIds = [
    ...bothUpdates.map((x) => x.idVal),
    ...scalarOnly.map((x) => x.idVal),
    ...assignmentOnly.map((x) => x.idVal)
  ];
  if (updatedIds.length > 0) {
    await appendClientAuditLogsBatch(
      tenantId,
      updatedIds,
      ctx.actorUserId ?? null,
      "client.import.patch",
      { source: "xlsx_import" }
    );
  }

  const out = [...errors];
  if (updated === 0 && errors.length === 0 && skippedEmpty > 0) {
    out.push(
      `Hech narsa yangilanmadi: «ИД» bo‘sh qatorlar (${skippedEmpty}) yoki jadval bo‘sh.`
    );
  } else if (updated === 0 && skippedEmpty === 0 && candidateIdList.length > 0) {
    out.unshift(
      "Hech qanday yozuv o‘zgarmadi: Excel qiymatlari bazadagi ma’lumot bilan bir xil yoki agent/ustunlar moslanmadi (konsoldagi ogohlantirishlarni ko‘ring)."
    );
  }
  if (totalRowErrors > IMPORT_MAX_ERRORS_RETURNED) {
    out.push(
      `… va yana ${totalRowErrors - IMPORT_MAX_ERRORS_RETURNED} ta qator xatosi (faqat birinchi ${IMPORT_MAX_ERRORS_RETURNED} matn qaytarildi).`
    );
  }

  for (const line of refResolver.summarizeMisses()) {
    out.push(line);
  }
  if (skippedDuplicate > 0) {
    out.push(`Dublikat / takroriy ИД o‘tkazib yuborildi: ${skippedDuplicate} qator.`);
  }

  return { updated, errors: out, skippedEmpty, unchangedRows };
}
