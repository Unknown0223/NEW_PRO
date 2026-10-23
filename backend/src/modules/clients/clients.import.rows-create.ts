import { prisma } from "../../config/database";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { buildDuplicateCompositeKey, duplicateKeyFromExistingRow } from "./client-import-masks";
import {
  buildAgentAssignmentPatchesFromImportRow,
  colMapHasAgentSlots,
  type ImportStaffLookup
} from "./clients.import.assign";
import {
  buildImportDecisionPreview,
  decideImportWriteAction,
  type ClientImportCommitDecision,
  type ClientImportDecisionPreview,
  type ClientImportRowIssue
} from "./clients.import.commit-policy";
import { classifyFlexibleImportId, MAX_CLIENT_CODE_ID_LEN } from "./clients.import.flexible-id";
import { filterImportAgentPatchesByWorkSlot } from "./clients.import.agent-slot-gate";
import { loadImportExplicitIdConflicts } from "./clients.import.id-lookup";
import { buildImportCreateRowScalar } from "./clients.import.rows-create.build";
import {
  latinNameOrImportError,
  peerFromImportExisting,
  skipReasonForNewImportRow,
  type ImportQualityPeerRow
} from "./clients.import.rows-create.quality";
import {
  writePendingImportCreates,
  type PendingImportCreate
} from "./clients.import.rows-create.write";
import { readArrayCell } from "./clients.import.parse";
import {
  IMPORT_MAX_DATA_ROWS,
  IMPORT_MAX_ERRORS_RETURNED,
  reportImportRowProgress,
  type ImportFlowContext
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
  duplicateKeyFields: string[],
  commitDecision?: ClientImportCommitDecision | null
): Promise<{
  created: number;
  updated: number;
  errors: string[];
  skippedDuplicate: number;
  skippedEmpty: number;
  needsDecision?: boolean;
  decisionPreview?: ClientImportDecisionPreview;
}> {
  const errors: string[] = [];
  const rowIssues: ClientImportRowIssue[] = [];
  let totalRowErrors = 0;
  const pushIssue = (issue: ClientImportRowIssue) => {
    totalRowErrors += 1;
    rowIssues.push(issue);
    const line = `Строка ${issue.excelRow}: ${issue.message}`;
    if (errors.length < IMPORT_MAX_ERRORS_RETURNED) errors.push(line);
  };

  let skippedEmpty = 0;
  let skippedDuplicate = 0;
  const hasAgentSlots = colMapHasAgentSlots(colIndexByKey);
  const hasIdCol = Object.prototype.hasOwnProperty.call(colIndexByKey, "client_db_id");

  const firstDataRow = headerRowIdx + 1;
  const lastRowIdx = Math.min(rows.length - 1, headerRowIdx + IMPORT_MAX_DATA_ROWS);

  if (firstDataRow > rows.length - 1) {
    return {
      created: 0,
      updated: 0,
      errors: [
        `Заголовок найден в строке ${headerRowIdx + 1} («${sheetLabel}»), но после него нет строк с данными.`
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
      city: true,
      latitude: true,
      longitude: true
    }
  });
  const qualityPeers: ImportQualityPeerRow[] = existingClients.map(peerFromImportExisting);
  const existingById = new Map(existingClients.map((c) => [c.id, c]));
  const existingByCode = new Map<string, (typeof existingClients)[number]>();
  for (const c of existingClients) {
    const code = c.client_code?.trim();
    if (code) existingByCode.set(code, c);
  }
  const seenDuplicateKeys = new Set<string>();
  const seenExplicitIds = new Set<number>();
  const seenExplicitCodes = new Set<string>();
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
    `[clients import/create] tenant=${tenantId} sheet="${sheetLabel}" fileRows=${rows.length} headerRow=${headerRowIdx + 1} estDataRows=${ctx.totalRows} mappedKeys=${Object.keys(colIndexByKey).length} existingInDb=${existingClients.length} duplicateKeys=${duplicateKeyFields.join(",")} idCol=${hasIdCol} commit=${commitDecision ?? "ask"}`
  );

  const pending: PendingImportCreate[] = [];
  const planStarted = Date.now();

  for (let ri = firstDataRow; ri <= lastRowIdx; ri++) {
    const row = rows[ri]!;
    const excelRow = ri + 1;

    const nameRaw = readArrayCell(row, colIndexByKey.name);
    if (nameRaw == null) {
      skippedEmpty += 1;
      continue;
    }

    let explicitId: number | null = null;
    let idCode: string | null = null;
    if (hasIdCol) {
      const idParse = classifyFlexibleImportId(readArrayCell(row, colIndexByKey.client_db_id), {
        maxCodeLen: MAX_CLIENT_CODE_ID_LEN,
        label: "ИД"
      });
      if (idParse.kind === "invalid") {
        pushIssue({
          excelRow,
          kind: "error",
          message: `неверный id — ${idParse.detail}`,
          fields: ["client_db_id"]
        });
        continue;
      }
      if (idParse.kind === "ok_db") {
        if (foreignIdSet.has(idParse.id)) {
          pushIssue({
            excelRow,
            kind: "error",
            message: `id=${idParse.id} принадлежит другой компании — использовать чужие id запрещено.`,
            fields: ["client_db_id"]
          });
          continue;
        }
        if (mergedIdSet.has(idParse.id)) {
          pushIssue({
            excelRow,
            kind: "error",
            message: `id=${idParse.id} — объединённый клиент, импорт невозможен.`,
            fields: ["client_db_id"]
          });
          continue;
        }
        if (seenExplicitIds.has(idParse.id)) {
          pushIssue({
            excelRow,
            kind: "error",
            message: `id=${idParse.id} повторяется в файле.`,
            fields: ["client_db_id"]
          });
          continue;
        }
        seenExplicitIds.add(idParse.id);
        explicitId = idParse.id;
      } else if (idParse.kind === "ok_code") {
        if (seenExplicitCodes.has(idParse.code)) {
          pushIssue({
            excelRow,
            kind: "error",
            message: `ИД/код «${idParse.code}» повторяется в файле.`,
            fields: ["client_db_id"]
          });
          continue;
        }
        seenExplicitCodes.add(idParse.code);
        idCode = idParse.code;
        const byCode = existingByCode.get(idParse.code);
        if (byCode) explicitId = byCode.id;
      }
    }

    const latinName = latinNameOrImportError(nameRaw.trim());
    if (!latinName.ok) {
      pushIssue({ excelRow, kind: "error", message: latinName.message, fields: ["name"] });
      continue;
    }
    const nameTrimmed = latinName.name;
    const built = buildImportCreateRowScalar(nameTrimmed, row, colIndexByKey, refResolver);
    let { scalarData, client_code, client_pinfl, inn, city, phoneNormalized, cityNorm } = built;
    if (idCode) {
      client_code = idCode;
      scalarData = { ...scalarData, client_code: idCode };
    }
    const existingForId = explicitId != null ? existingById.get(explicitId) : undefined;
    const isUpsertUpdate = existingForId != null;

    let dupKey: string | null = null;
    if (!isUpsertUpdate) {
      dupKey = buildDuplicateCompositeKey(duplicateKeyFields, {
        client_code,
        client_pinfl,
        inn,
        nameLower: nameTrimmed.toLocaleLowerCase("ru-RU"),
        phoneDigits: phoneNormalized?.replace(/\D/g, "") ?? null,
        cityNorm
      });
      const skip = skipReasonForNewImportRow(
        {
          name: nameTrimmed,
          phoneDigits: phoneNormalized,
          inn,
          pinfl: client_pinfl,
          lat: scalarData.latitude == null ? null : Number(scalarData.latitude),
          lon: scalarData.longitude == null ? null : Number(scalarData.longitude)
        },
        qualityPeers,
        dupKey,
        seenDuplicateKeys,
        duplicateKeyFields
      );
      if (skip) {
        skippedDuplicate += 1;
        const fields =
          skip.kind === "dup"
            ? duplicateKeyFields.length
              ? [...duplicateKeyFields]
              : ["client_code"]
            : ["name", "phone", "inn", "client_pinfl", "latitude", "longitude"].filter((f) =>
                Object.prototype.hasOwnProperty.call(colIndexByKey, f === "phone" ? "phone" : f)
              );
        pushIssue({
          excelRow,
          kind: skip.kind === "dup" ? "duplicate" : "error",
          message: skip.message,
          fields
        });
        continue;
      }
      if (dupKey) seenDuplicateKeys.add(dupKey);
    }

    const assignOutcome = hasAgentSlots
      ? buildAgentAssignmentPatchesFromImportRow(
          row,
          colIndexByKey,
          staffLookup,
          excelRow,
          ctx.warnings.push
        )
      : { createPatches: [], updatePatches: [], touched: false, hardErrors: [], hardErrorFields: [] };
    if (assignOutcome.hardErrors.length > 0) {
      pushIssue({
        excelRow,
        kind: "error",
        message: assignOutcome.hardErrors.join("; "),
        fields: assignOutcome.hardErrorFields
      });
      continue;
    }
    const agentPatches = await filterImportAgentPatchesByWorkSlot(
      tenantId,
      assignOutcome.createPatches,
      { excelRow, warn: ctx.warnings.push }
    );

    // Re-import / intra-file: to‘g‘ri qatorlar sifat tekshiruvida keyingi qatorlarga peer bo‘ladi
    qualityPeers.push(
      peerFromImportExisting({
        id: explicitId ?? -(pending.length + 1),
        name: nameTrimmed,
        phone_normalized: phoneNormalized,
        inn,
        client_pinfl,
        latitude: scalarData.latitude,
        longitude: scalarData.longitude
      })
    );

    pending.push({
      kind: isUpsertUpdate ? "update" : "create",
      excelRow,
      explicitId,
      scalarData: scalarData as Record<string, unknown>,
      agentPatches,
      peer: {
        name: nameTrimmed,
        phone_normalized: phoneNormalized,
        client_code,
        client_pinfl,
        inn,
        city,
        latitude: scalarData.latitude,
        longitude: scalarData.longitude
      },
      dupKey
    });

    if ((pending.length + skippedEmpty + skippedDuplicate) % 200 === 0) {
      ctx.processedRows = pending.length + skippedEmpty + skippedDuplicate + totalRowErrors;
      await reportImportRowProgress(ctx, "resolving");
    }
  }

  ctx.writeMs += 0;
  const planMs = Date.now() - planStarted;
  console.info(
    `[clients import/create] plan done tenant=${tenantId} pending=${pending.length} errors=${totalRowErrors} dups=${skippedDuplicate} empty=${skippedEmpty} planMs=${planMs}`
  );

  const action = decideImportWriteAction({
    errorCount: totalRowErrors,
    validCount: pending.length,
    commitDecision
  });

  const decisionPreview = buildImportDecisionPreview({
    validCount: pending.length,
    issues: rowIssues
  });

  if (action === "ask") {
    ctx.processedRows = pending.length + skippedEmpty + skippedDuplicate + totalRowErrors;
    await reportImportRowProgress(ctx, "finalizing", true);
    const out = [...errors];
    out.unshift(
      `В импорте ошибок / дубликатов: ${totalRowErrors}. Корректных строк в ожидании: ${pending.length} — выберите «принять только корректные» или «отменить всё».`
    );
    if (skippedDuplicate > 0) {
      out.push(
        `Дубликаты никогда не принимаются: строк — ${skippedDuplicate} (ключ: ${duplicateKeyFields.join(", ") || "—"}).`
      );
    }
    if (totalRowErrors > IMPORT_MAX_ERRORS_RETURNED) {
      out.push(
        `… и ещё ошибок в строках: ${totalRowErrors - IMPORT_MAX_ERRORS_RETURNED} (показаны только первые ${IMPORT_MAX_ERRORS_RETURNED}).`
      );
    }
    for (const line of refResolver.summarizeMisses()) out.push(line);
    return {
      created: 0,
      updated: 0,
      errors: out,
      skippedDuplicate,
      skippedEmpty,
      needsDecision: true,
      decisionPreview
    };
  }

  if (action === "reject") {
    ctx.processedRows = pending.length + skippedEmpty + skippedDuplicate + totalRowErrors;
    await reportImportRowProgress(ctx, "finalizing", true);
    const out = [...errors];
    if (commitDecision === "reject_all") {
      out.unshift("Импорт отменён: ни одна строка не записана.");
    } else if (pending.length === 0 && totalRowErrors > 0) {
      out.unshift("Нет корректных строк — ничего не добавлено.");
    }
    if (skippedDuplicate > 0) {
      out.push(
        `Дубликаты не приняты: строк — ${skippedDuplicate} (ключ: ${duplicateKeyFields.join(", ") || "—"}).`
      );
    }
    if (totalRowErrors > IMPORT_MAX_ERRORS_RETURNED) {
      out.push(
        `… и ещё ошибок в строках: ${totalRowErrors - IMPORT_MAX_ERRORS_RETURNED} (показаны только первые ${IMPORT_MAX_ERRORS_RETURNED}).`
      );
    }
    for (const line of refResolver.summarizeMisses()) out.push(line);
    return {
      created: 0,
      updated: 0,
      errors: out,
      skippedDuplicate,
      skippedEmpty,
      needsDecision: false,
      decisionPreview
    };
  }

  // accept_valid yoki xatosiz — dublikatlar pendingga umuman kirmagan
  const writeRes = await writePendingImportCreates(tenantId, pending, ctx);
  for (const e of writeRes.errors) {
    if (errors.length < IMPORT_MAX_ERRORS_RETURNED) errors.push(e);
  }

  const out = [...errors];
  if (writeRes.created === 0 && writeRes.updated === 0 && errors.length === 0 && skippedEmpty > 0) {
    out.push(
      `Никто не добавлен: в строках Excel ${headerRowIdx + 2}–${rows.length} поле «name» пустое или --- (пропущено строк: ${skippedEmpty}).`
    );
  }
  if (skippedDuplicate > 0) {
    out.push(
      `Клиенты-дубликаты не приняты: строк — ${skippedDuplicate} (ключевые поля: ${duplicateKeyFields.join(", ")}).`
    );
  }
  if (commitDecision === "accept_valid" && totalRowErrors > 0) {
    out.unshift(
      `Записаны только корректные строки: добавлено +${writeRes.created}` +
        (writeRes.updated > 0 ? `, обновлено ${writeRes.updated}` : "") +
        `; пропущено ошибок/дубликатов: ${totalRowErrors}.`
    );
  }
  if (totalRowErrors > IMPORT_MAX_ERRORS_RETURNED) {
    out.push(
      `… и ещё ошибок в строках: ${totalRowErrors - IMPORT_MAX_ERRORS_RETURNED} (возвращены только первые ${IMPORT_MAX_ERRORS_RETURNED}).`
    );
  }
  for (const line of refResolver.summarizeMisses()) out.push(line);

  return {
    created: writeRes.created,
    updated: writeRes.updated,
    errors: out,
    skippedDuplicate,
    skippedEmpty,
    needsDecision: false,
    decisionPreview: totalRowErrors > 0 ? decisionPreview : undefined
  };
}
