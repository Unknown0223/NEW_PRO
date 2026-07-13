import * as XLSX from "xlsx";
import { ClientImportRefResolver } from "./client-import-ref-resolve";
import { normalizeDuplicateKeyFields, normalizeUpdateApplyFields } from "./client-import-masks";
import {
  buildManualColumnMap,
  loadImportStaffLookup,
  parseClientDbIdFromCell
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
      message: "Import fayli bo‘sh yoki juda kichik."
    });
    return { created: 0, updated: 0, errors: ["Fayl bo‘sh yoki juda kichik."] };
  }
  if (raw[0] !== 0x50 || raw[1] !== 0x4b) {
    await emitClientImportProgress(opts?.onProgress, {
      stage: "failed",
      percent: 100,
      processedRows: 0,
      totalRows: 0,
      message: "Noto‘g‘ri fayl formati."
    });
    return {
      created: 0,
      updated: 0,
      errors: [
        "Bu fayl standart .xlsx (zip) ko‘rinishida emas. Ehtimol .xls yoki boshqa dastur eksporti. Excelda «Fayl → Saqlash tur» dan .xlsx tanlang."
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
      message: "XLSX o‘qilmadi."
    });
    return {
      created: 0,
      updated: 0,
      errors: [
        "Fayl o‘qilmadi. Buzilgan .xlsx yoki noto‘g‘ri format. Excelda qayta saqlang (.xlsx) yoki loyiha shablonidan foydalaning.",
        `Texnik: ${hint.slice(0, 200)}`
      ]
    };
  }

  if (!wb.SheetNames.length) {
    await emitClientImportProgress(opts?.onProgress, {
      stage: "failed",
      percent: 100,
      processedRows: 0,
      totalRows: 0,
      message: "Varaqlar topilmadi."
    });
    return { created: 0, updated: 0, errors: ["Jadvalda varaq yo‘q."] };
  }

  const resolveStarted = Date.now();
  const refResolver = await ClientImportRefResolver.load(tenantId);
  const staffLookup = await loadImportStaffLookup(tenantId);
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
    manualMap = { ...manualMap };
    delete manualMap.client_db_id;
    if (!Object.prototype.hasOwnProperty.call(manualMap, "name")) {
      return {
        created: 0,
        updated: 0,
        errors: [
          "Yangi import (importMode=create): xaritada «Наименование» (name) ustuni bo‘lishi kerak; ichki ИД ustuni ishlatilmaydi."
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
        errors: [`Varaq topilmadi: «${wantSheet}». Mavjud: ${wb.SheetNames.join(", ")}.`]
      };
    }
    const ws = sheetName ? wb.Sheets[sheetName] : undefined;
    if (!ws) {
      return { created: 0, updated: 0, errors: ["Varaq o‘qilmadi."] };
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
        errors: [`Sarlavha qatori noto‘g‘ri (0…${Math.max(0, rows.length - 1)}).`]
      };
    }
    const unknownHeaders = collectUnknownAssignmentHeaders(rows[headerRowIdx]);
    if (unknownHeaders.length > 0) {
      warnings.push(
        `Import: agentga oid tanilmagan ustunlar topildi (${unknownHeaders.slice(0, 10).join(", ")}).`
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
      writeMs: 0
    };
    const isUpdate = Object.prototype.hasOwnProperty.call(manualMap, "client_db_id");
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
            skippedEmpty: r.skippedEmpty
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
      duplicateKeyFields
    );
    await reportImportRowProgress(ctx, "finalizing", true);
    return finalizeResult(
      {
        created: r.created,
        updated: 0,
        errors: r.errors,
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
        `Hech bir varaqning dastlabki ${IMPORT_HEADER_SCAN_ROWS} qatorida majburiy ustun (наименование yoki ИД) topilmadi.`,
        preview
          ? `Birinchi varaq, 1-qator (namuna): ${preview}`
          : "Birinchi varaq bo‘sh yoki o‘qilmadi."
      ]
    };
  }

  const { rows, headerRowIdx, colIndexByKey } = table;
  const unknownHeaders = collectUnknownAssignmentHeaders(rows[headerRowIdx]);
  if (unknownHeaders.length > 0) {
    warnings.push(
      `Import: agentga oid tanilmagan ustunlar topildi (${unknownHeaders.slice(0, 10).join(", ")}).`
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
    writeMs: 0
  };
  const isUpdate = Object.prototype.hasOwnProperty.call(colIndexByKey, "client_db_id");
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
          skippedEmpty: r.skippedEmpty
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
    duplicateKeyFields
  );
  await reportImportRowProgress(ctx, "finalizing", true);
  return finalizeResult(
    {
      created: r.created,
      updated: 0,
      errors: r.errors,
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
