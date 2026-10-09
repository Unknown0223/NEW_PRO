import * as XLSX from "xlsx";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { normalizeDuplicateKeyFields, normalizeUpdateApplyFields } from "./client-import-masks";
import {
  buildManualColumnMap,
  loadImportStaffLookup
} from "./clients.import.assign";
import { importClientDataRows } from "./clients.import.rows-create";
import { importClientUpdateRows } from "./clients.import.rows-update";
import { buildColIndexFromHeaderRow, collectUnknownAssignmentHeaders } from "./clients.import.runtime";
import {
  type ClientXlsxImportOptions,
  type ClientXlsxImportResult,
  type ImportFlowContext,
  createImportWarningCollector,
  emitClientImportProgress,
  estimateImportTotalRows,
  findImportTableInWorkbook,
  IMPORT_HEADER_SCAN_ROWS,
  reportImportRowProgress,
  sheetToRowsMatrix
} from "./clients.import.runtime";
import { headerLabelFromCell } from "./clients.import.parse";

export async function importClientsFromXlsx(
  tenantId: number,
  buffer: Buffer | Uint8Array,
  opts?: ClientXlsxImportOptions
): Promise<ClientXlsxImportResult> {
  const warnings = createImportWarningCollector();
  const startedAt = Date.now();
  await emitClientImportProgress(opts?.onProgress, {
    stage: "queued",
    percent: 0,
    processedRows: 0,
    totalRows: 0
  });
  const raw = Buffer.from(buffer);
  if (raw.length < 4) {
    await emitClientImportProgress(opts?.onProgress, {
      stage: "failed",
      percent: 100,
      processedRows: 0,
      totalRows: 0,
      message: "Файл импорта пуст или слишком мал."
    });
    return { created: 0, updated: 0, errors: ["Файл пуст или слишком мал."] };
  }
  if (raw[0] !== 0x50 || raw[1] !== 0x4b) {
    await emitClientImportProgress(opts?.onProgress, {
      stage: "failed",
      percent: 100,
      processedRows: 0,
      totalRows: 0,
      message: "Неверный формат файла."
    });
    return {
      created: 0,
      updated: 0,
      errors: [
        "Файл не является стандартным .xlsx (zip). Возможно, это .xls или выгрузка из другой программы. В Excel выберите «Файл → Сохранить как» и формат .xlsx."
      ]
    };
  }

  let wb: XLSX.WorkBook;
  try {
    await emitClientImportProgress(opts?.onProgress, {
      stage: "parsing",
      percent: 5,
      processedRows: 0,
      totalRows: 0
    });
    wb = XLSX.read(raw, {
      type: "buffer",
      cellDates: true,
      dense: false,
      bookVBA: false,
      cellFormula: false,
      cellHTML: false,
      cellText: false
    });
  } catch (e) {
    const hint = e instanceof Error ? e.message : String(e);
    await emitClientImportProgress(opts?.onProgress, {
      stage: "failed",
      percent: 100,
      processedRows: 0,
      totalRows: 0,
      message: "Не удалось прочитать XLSX."
    });
    return {
      created: 0,
      updated: 0,
      errors: [
        "Не удалось прочитать файл: повреждённый .xlsx или неверный формат. Пересохраните его в Excel (.xlsx) или используйте шаблон системы.",
        `Техническая информация: ${hint.slice(0, 200)}`
      ]
    };
  }

  if (!wb.SheetNames.length) {
    await emitClientImportProgress(opts?.onProgress, {
      stage: "failed",
      percent: 100,
      processedRows: 0,
      totalRows: 0,
      message: "Листы не найдены."
    });
    return { created: 0, updated: 0, errors: ["В файле нет листов."] };
  }

  const resolveStarted = Date.now();
  const refResolver = await ClientImportRefResolver.load(tenantId);
  const staffLookup = await loadImportStaffLookup(tenantId, {
    includeInactive: opts?.importMode === "update"
  });
  const resolveMs = Date.now() - resolveStarted;
  const duplicateKeyFields = normalizeDuplicateKeyFields(opts?.duplicateKeyFields);
  const updateApplyFields = normalizeUpdateApplyFields(opts?.updateApplyFields);
  await emitClientImportProgress(opts?.onProgress, {
    stage: "resolving",
    percent: 10,
    processedRows: 0,
    totalRows: 0
  });

  const finalizeResult = async (
    base: ClientXlsxImportResult,
    ctx?: Pick<ImportFlowContext, "parseMs" | "resolveMs" | "writeMs" | "processedRows" | "totalRows">
  ): Promise<ClientXlsxImportResult> => {
    const errors = [...base.errors];
    for (const line of warnings.list) errors.push(line);
    if (ctx) {
      const elapsedMs = Date.now() - startedAt;
      const perf = `Import stats: parse=${ctx.parseMs}ms, resolve=${ctx.resolveMs}ms, write=${ctx.writeMs}ms, total=${elapsedMs}ms.`;
      errors.push(perf);
    }
    const st = base.importStats;
    const doneMsg =
      st != null
        ? `Готово: ${st.processedRows} / ${st.totalRows} строк; добавлено ${base.created}, обновлено ${base.updated}` +
          (st.skippedDuplicate > 0 ? `; дубликатов: ${st.skippedDuplicate}` : "") +
          (st.skippedEmpty > 0 ? `; пустых: ${st.skippedEmpty}` : "")
        : undefined;
    await emitClientImportProgress(opts?.onProgress, {
      stage: "done",
      percent: 100,
      processedRows: st?.processedRows ?? ctx?.processedRows ?? 0,
      totalRows: st?.totalRows ?? ctx?.totalRows ?? 0,
      message: doneMsg
    });
    return { ...base, errors };
  };

  let manualMap = buildManualColumnMap(opts?.columnMap);
  if (manualMap != null && opts?.importMode === "create") {
    if (!Object.prototype.hasOwnProperty.call(manualMap, "name")) {
      return {
        created: 0,
        updated: 0,
        errors: [
          "Новый импорт (importMode=create): в сопоставлении должен быть столбец «Наименование» (name). Необязательный «ИД» — число (ID в базе) или текстовый код (ks_1652, g3_516…); если указан, запись создаётся/обновляется по нему."
        ]
      };
    }
  }
  if (manualMap != null) {
    const wantSheet = opts?.sheetName?.trim();
    const sheetName =
      wantSheet && wb.SheetNames.includes(wantSheet) ? wantSheet : wb.SheetNames[0];
    if (wantSheet && !wb.SheetNames.includes(wantSheet)) {
      return {
        created: 0,
        updated: 0,
        errors: [`Лист не найден: «${wantSheet}». Доступные листы: ${wb.SheetNames.join(", ")}.`]
      };
    }
    const ws = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!ws) {
      return { created: 0, updated: 0, errors: ["Не удалось прочитать лист."] };
    }
    const rows = sheetToRowsMatrix(ws);
    let headerRowIdx =
      typeof opts?.headerRowIndex === "number" && Number.isFinite(opts.headerRowIndex)
        ? Math.floor(opts.headerRowIndex)
        : 0;
    if (headerRowIdx < 0 || headerRowIdx >= rows.length) {
      return {
        created: 0,
        updated: 0,
        errors: [`Неверная строка заголовка (допустимо 0…${Math.max(0, rows.length - 1)}).`]
      };
    }
    const unknownHeaders = collectUnknownAssignmentHeaders(rows[headerRowIdx]);
    if (unknownHeaders.length > 0) {
      warnings.push(
        `Импорт: найдены нераспознанные столбцы, относящиеся к агентам (${unknownHeaders.slice(0, 10).join(", ")}).`
      );
    }
    const totalRows = estimateImportTotalRows(rows, headerRowIdx);
    const ctx: ImportFlowContext = {
      warnings,
      progressSink: opts?.onProgress,
      totalRows,
      processedRows: 0,
      parseMs: Date.now() - startedAt - resolveMs,
      resolveMs,
      writeMs: 0,
      actorUserId: opts?.actorUserId ?? null
    };
    const hasDbId = Object.prototype.hasOwnProperty.call(manualMap, "client_db_id");
    const isUpdate =
      opts?.importMode === "update" || (opts?.importMode !== "create" && hasDbId);
    if (isUpdate) {
      const r = await importClientUpdateRows(
        tenantId,
        rows,
        headerRowIdx,
        manualMap,
        sheetName ?? "",
        refResolver,
        staffLookup,
        ctx,
        updateApplyFields
      );
      await reportImportRowProgress(ctx, "finalizing", true);
      return finalizeResult(
        {
          created: 0,
          updated: r.updated,
          errors: r.errors,
          importStats: {
            totalRows: ctx.totalRows,
            processedRows: ctx.processedRows,
            skippedDuplicate: 0,
            skippedEmpty: r.skippedEmpty,
            unchangedRows: r.unchangedRows
          }
        },
        ctx
      );
    }
    const r = await importClientDataRows(
      tenantId,
      rows,
      headerRowIdx,
      manualMap,
      sheetName ?? "",
      refResolver,
      staffLookup,
      ctx,
      duplicateKeyFields,
      opts?.commitDecision
    );
    await reportImportRowProgress(ctx, "finalizing", true);
    return finalizeResult(
      {
        created: r.created,
        updated: r.updated,
        errors: r.errors,
        needsDecision: r.needsDecision,
        decisionPreview: r.decisionPreview,
        importStats: {
          totalRows: ctx.totalRows,
          processedRows: ctx.processedRows,
          skippedDuplicate: r.skippedDuplicate,
          skippedEmpty: r.skippedEmpty,
          unchangedRows: 0
        }
      },
      ctx
    );
  }

  const table = findImportTableInWorkbook(wb);
  if (!table) {
    const first = wb.SheetNames[0];
    const ws0 = first ? wb.Sheets[first] : undefined;
    const rows0 = ws0 ? sheetToRowsMatrix(ws0) : [];
    const headerTry = rows0[0];
    const sample = (Array.isArray(headerTry) ? headerTry : [])
      .map((c) => headerLabelFromCell(c))
      .filter(Boolean)
      .slice(0, 12);
    const preview = sample.join(" | ");
    return {
      created: 0,
      updated: 0,
      errors: [
        `Ни на одном листе в первых ${IMPORT_HEADER_SCAN_ROWS} строках не найден обязательный столбец (наименование или ИД).`,
        preview
          ? `Первый лист, строка 1 (образец): ${preview}`
          : "Первый лист пуст или не читается."
      ]
    };
  }

  const { rows, headerRowIdx, colIndexByKey } = table;
  const unknownHeaders = collectUnknownAssignmentHeaders(rows[headerRowIdx]);
  if (unknownHeaders.length > 0) {
    warnings.push(
      `Импорт: найдены нераспознанные столбцы, относящиеся к агентам (${unknownHeaders.slice(0, 10).join(", ")}).`
    );
  }
  const totalRows = estimateImportTotalRows(rows, headerRowIdx);
  const ctx: ImportFlowContext = {
    warnings,
    progressSink: opts?.onProgress,
    totalRows,
    processedRows: 0,
    parseMs: Date.now() - startedAt - resolveMs,
    resolveMs,
    writeMs: 0,
    actorUserId: opts?.actorUserId ?? null
  };
  const hasDbId = Object.prototype.hasOwnProperty.call(colIndexByKey, "client_db_id");
  const isUpdate =
    opts?.importMode === "update" || (opts?.importMode !== "create" && hasDbId);
  if (isUpdate) {
    const r = await importClientUpdateRows(
      tenantId,
      rows,
      headerRowIdx,
      colIndexByKey,
      table.sheetName,
      refResolver,
      staffLookup,
      ctx,
      updateApplyFields
    );
    await reportImportRowProgress(ctx, "finalizing", true);
    return finalizeResult(
      {
        created: 0,
        updated: r.updated,
        errors: r.errors,
        importStats: {
          totalRows: ctx.totalRows,
          processedRows: ctx.processedRows,
          skippedDuplicate: 0,
          skippedEmpty: r.skippedEmpty,
          unchangedRows: r.unchangedRows
        }
      },
      ctx
    );
  }
  const r = await importClientDataRows(
    tenantId,
    rows,
    headerRowIdx,
    colIndexByKey,
    table.sheetName,
    refResolver,
    staffLookup,
    ctx,
    duplicateKeyFields,
    opts?.commitDecision
  );
  await reportImportRowProgress(ctx, "finalizing", true);
  return finalizeResult(
    {
      created: r.created,
      updated: r.updated,
      errors: r.errors,
      needsDecision: r.needsDecision,
      decisionPreview: r.decisionPreview,
      importStats: {
        totalRows: ctx.totalRows,
        processedRows: ctx.processedRows,
        skippedDuplicate: r.skippedDuplicate,
        skippedEmpty: r.skippedEmpty
      }
    },
    ctx
  );
}
