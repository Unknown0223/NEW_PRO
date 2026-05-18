import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { applyTerritoryAutoAssignAfterAddressChange, clientUpdateTouchesAddress } from "../work-slots/work-slots.territory-auto";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { filterClientUpdateInputByApplyFields } from "./client-import-masks";
import { normalizePhoneDigits } from "./clients.types";
import { CONTACT_SLOTS, IMPORT_CONTACT_PERSON_SLOTS, contactPersonsToJson } from "./clients.helpers";
import { replaceClientAgentAssignments } from "./clients.agent-assignments";
import { appendClientAuditLog } from "./clients.audit";
import {
  buildAgentAssignmentPatchesFromImportRow,
  colMapHasAgentSlots,
  parseClientDbIdFromCell,
  type ImportStaffLookup
} from "./clients.import.assign";
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
  reportImportRowProgress
} from "./clients.import.runtime";
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
): Promise<{ updated: number; errors: string[]; skippedEmpty: number }> {
  const errors: string[] = [];
  let totalRowErrors = 0;
  const pushErr = (msg: string) => {
    totalRowErrors += 1;
    if (errors.length < IMPORT_MAX_ERRORS_RETURNED) errors.push(msg);
  };

  let updated = 0;
  let skippedEmpty = 0;

  const firstDataRow = headerRowIdx + 1;
  const lastRowIdx = Math.min(rows.length - 1, headerRowIdx + IMPORT_MAX_DATA_ROWS);

  if (firstDataRow > rows.length - 1) {
    return {
      updated: 0,
      errors: [
        `Sarlavha ${headerRowIdx + 1}-qatorda («${sheetLabel}»), lekin undan keyin ma’lumot qatori yo‘q.`
      ],
      skippedEmpty: 0
    };
  }

  const applySet =
    updateApplyFields != null && updateApplyFields.length > 0 ? new Set(updateApplyFields) : null;
  const hasAgentSlots = colMapHasAgentSlots(colIndexByKey);
  const candidateIds = new Set<number>();
  for (let r = firstDataRow; r <= lastRowIdx; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    const idVal = parseClientDbIdFromCell(readArrayCell(row, colIndexByKey.client_db_id));
    if (idVal != null) candidateIds.add(idVal);
  }
  const candidateIdList = Array.from(candidateIds);
  console.info(
    `[clients import/update] tenant=${tenantId} sheet="${sheetLabel}" estDataRows=${ctx.totalRows} distinctClientIdsInFile=${candidateIdList.length}`
  );
  const existingRows =
    candidateIdList.length > 0
      ? await prisma.client.findMany({
          where: {
            id: { in: candidateIdList },
            tenant_id: tenantId,
            merged_into_client_id: null
          },
          select: {
            id: true,
            name: true,
            legal_name: true,
            phone: true,
            phone_normalized: true,
            address: true,
            client_code: true,
            client_pinfl: true,
            category: true,
            client_type_code: true,
            credit_limit: true,
            is_active: true,
            responsible_person: true,
            landmark: true,
            inn: true,
            pdl: true,
            logistics_service: true,
            license_until: true,
            working_hours: true,
            region: true,
            district: true,
            city: true,
            neighborhood: true,
            zone: true,
            street: true,
            house_number: true,
            apartment: true,
            gps_text: true,
            latitude: true,
            longitude: true,
            notes: true,
            client_format: true,
            sales_channel: true,
            product_category_ref: true,
            contact_persons: true
          }
        })
      : [];
  const existingById = new Map(existingRows.map((x) => [x.id, x]));
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
  if (hasAgentSlots && candidateIdList.length > 0) {
    const assignmentRows = await prisma.clientAgentAssignment.findMany({
      where: { tenant_id: tenantId, client_id: { in: candidateIdList } },
      orderBy: [{ client_id: "asc" }, { slot: "asc" }],
      select: {
        client_id: true,
        slot: true,
        agent_id: true,
        expeditor_user_id: true,
        expeditor_phone: true,
        visit_weekdays: true
      }
    });
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

  for (let r = firstDataRow; r <= lastRowIdx; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) {
      skippedEmpty += 1;
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }

    const idVal = parseClientDbIdFromCell(readArrayCell(row, colIndexByKey.client_db_id));
    if (idVal == null) {
      skippedEmpty += 1;
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "parsing");
      continue;
    }

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
      const agentPatches = assignOutcome.updatePatches;
      ctx.resolveMs += Date.now() - resolveStarted;

      const existing = existingById.get(idVal);
      if (!existing) {
        throw new Error(`NOT_FOUND`);
      }
      const nextData = filterUnchangedImportScalarData(data, existing);
      const hasScalars = Object.keys(nextData).length > 0;
      const nextAssignments = normalizeIncomingImportAssignments(agentPatches);
      const currentAssignments = currentAssignmentsByClientId.get(idVal) ?? [];
      const hasAssignmentChange =
        assignOutcome.touched && !importAssignmentsEqual(nextAssignments, currentAssignments);
      if (!hasScalars && !hasAssignmentChange) {
        ctx.processedRows += 1;
        await reportImportRowProgress(ctx, "resolving");
        continue;
      }
      const writeStarted = Date.now();
      if (hasScalars && hasAssignmentChange) {
        await prisma.$transaction(async (tx) => {
          await tx.client.update({ where: { id: idVal }, data: nextData });
          await replaceClientAgentAssignments(tx, tenantId, idVal, agentPatches, {
            skipStaffDbValidation: true
          });
        });
      } else if (hasScalars) {
        await prisma.client.update({ where: { id: idVal }, data: nextData });
      } else if (hasAssignmentChange) {
        await prisma.$transaction(async (tx) => {
          await replaceClientAgentAssignments(tx, tenantId, idVal, agentPatches, {
            skipStaffDbValidation: true
          });
        });
      }
      if (hasAssignmentChange) {
        currentAssignmentsByClientId.set(idVal, nextAssignments);
      }
      ctx.writeMs += Date.now() - writeStarted;
      const rowChanged = hasScalars || hasAssignmentChange;
      if (rowChanged) {
        updated += 1;
      }
      ctx.processedRows += 1;
      await reportImportRowProgress(ctx, "writing");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "xato";
      if (raw === "NOT_FOUND") {
        pushErr(`Qator ${r + 1} (Excel): mijoz topilmadi yoki birlashtirilgan (id=${idVal}).`);
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
      await reportImportRowProgress(ctx, "writing");
    }
  }

  const out = [...errors];
  if (updated === 0 && errors.length === 0 && skippedEmpty > 0) {
    out.push(
      `Hech narsa yangilanmadi: «ИД» bo‘sh qatorlar (${skippedEmpty}) yoki jadval bo‘sh.`
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

  return { updated, errors: out, skippedEmpty };
}
