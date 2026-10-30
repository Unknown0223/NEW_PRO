/**
 * Shared staff Excel import (create/update) parameterized by StaffImportKind.
 */

import { createStaff } from "./staff.crud.create";
import { patchAgent } from "./staff.patches.field.agent";
import { patchSupervisor } from "./staff.patches.field.supervisor";
import { patchOperator, patchSkladchik } from "./staff.patches.field.roles";
import {
  patchAuditor,
  patchCollector,
  patchExpeditor
} from "./staff.patches.web-agents-roles";
import type { CreateStaffInput, StaffKind } from "./staff.shared";
import { STAFF_KINDS_WITH_WORK_SLOT } from "./staff.shared";
import {
  STAFF_IMPORT_DEFAULT_PASSWORD,
  STAFF_IMPORT_MAX_ERRORS,
  STAFF_IMPORT_MAX_ROWS,
  STAFF_IMPORT_SHEET_NAME,
  type StaffImportKind
} from "./staff.import.kinds";
import {
  buildStaffImportHeaderMap,
  cell,
  normPinfl,
  parseNameFromFio,
  readAllStaffSheetsFromBuffer,
  readMatrixForKindFromBuffer,
  suggestLogin,
  yesRu
} from "./staff.import.headers";
import {
  findExistingStaffUser,
  parseOperatorWebKind,
  resolveAgentIdsFromCell,
  resolveWarehouseIdByName,
  resolveWarehouseIdsByNames,
  resolveWorkSlotIdByCode,
  isWorkSlotInactive
} from "./staff.import.resolve";
import * as XLSX from "xlsx";

export type StaffImportResult = {
  created: number;
  updated: number;
  errors: string[];
  importStats: {
    totalRows: number;
    processedRows: number;
    skippedEmpty: number;
  };
};

export type StaffWorkbookImportResult = StaffImportResult & {
  byKind: Partial<Record<StaffImportKind, StaffImportResult>>;
};

function mapCreateError(msg: string): string {
  switch (msg) {
    case "LOGIN_EXISTS":
      return "логин уже существует";
    case "BAD_LOGIN":
      return "некорректный логин";
    case "BAD_PASSWORD":
      return "пароль меньше 6 символов";
    case "BAD_FIRST_NAME":
      return "не указано имя (Ф.И.О)";
    case "BAD_WAREHOUSE":
      return "склад не найден";
    case "WORK_SLOT_REQUIRED":
      return "требуется рабочее место (колонка «Рабочее место»)";
    case "BAD_RETURN_WAREHOUSE":
      return "склад возврата не найден";
    case "BAD_USER":
      return "сотрудник не найден";
    case "SLOT_INACTIVE":
      return "рабочее место неактивно — активируйте его в «Рабочие места»";
    case "BAD_SLOT_TYPE":
      return "роль сотрудника не совпадает с типом рабочего места";
    default:
      return msg || "ошибка создания";
  }
}

async function applyPatch(
  tenantId: number,
  kind: StaffImportKind,
  userId: number,
  patch: Record<string, unknown>,
  actorUserId: number | null
): Promise<void> {
  switch (kind) {
    case "agent":
      await patchAgent(tenantId, userId, patch as Parameters<typeof patchAgent>[2], actorUserId);
      return;
    case "expeditor":
      await patchExpeditor(tenantId, userId, patch as Parameters<typeof patchExpeditor>[2], actorUserId);
      return;
    case "supervisor":
      await patchSupervisor(tenantId, userId, patch as Parameters<typeof patchSupervisor>[2], actorUserId);
      return;
    case "collector":
      await patchCollector(tenantId, userId, patch as Parameters<typeof patchCollector>[2], actorUserId);
      return;
    case "auditor":
      await patchAuditor(tenantId, userId, patch as Parameters<typeof patchAuditor>[2], actorUserId);
      return;
    case "skladchik":
      await patchSkladchik(tenantId, userId, patch as Parameters<typeof patchSkladchik>[2], actorUserId);
      return;
    case "operator":
      await patchOperator(tenantId, userId, patch as Parameters<typeof patchOperator>[2], actorUserId);
      return;
  }
}

export async function importStaffFromMatrix(
  tenantId: number,
  kind: StaffImportKind,
  matrix: unknown[][],
  actorUserId: number | null = null,
  opts?: { defaultPassword?: string; errorPrefix?: string; defaultWebRole?: string }
): Promise<StaffImportResult> {
  const defaultPassword = (opts?.defaultPassword || STAFF_IMPORT_DEFAULT_PASSWORD).trim();
  const errPrefix = opts?.errorPrefix ?? "";
  if (matrix.length < 2) {
    throw new Error("EMPTY_FILE");
  }

  const headerRow = matrix[0] as unknown[];
  const h = buildStaffImportHeaderMap(headerRow, kind);
  if (h.fio === undefined) {
    throw new Error("MISSING_FIO_COLUMN");
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > STAFF_IMPORT_MAX_ROWS) {
    throw new Error("TOO_MANY_ROWS");
  }

  const needsWorkSlot = false; // Joyga bog‘lash faqat «Рабочее место» dan — Excel da majburiy emas

  let created = 0;
  let updated = 0;
  let skippedEmpty = 0;
  let processedRows = 0;
  const errors: string[] = [];

  const pushErr = (excelRow: number, message: string) => {
    if (errors.length >= STAFF_IMPORT_MAX_ERRORS) return;
    errors.push(`${errPrefix}Строка ${excelRow}: ${message}`);
  };

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] as unknown[];
    const excelRow = i + 2;
    if (!row || row.every((c) => c === "" || c == null)) {
      skippedEmpty++;
      continue;
    }

    const fioRaw = cell(row, h.fio);
    if (!fioRaw) {
      skippedEmpty++;
      continue;
    }

    processedRows++;
    const { first_name, last_name, middle_name } = parseNameFromFio(fioRaw);
    const codeRaw = h.code !== undefined ? cell(row, h.code).toUpperCase().replace(/\s+/g, "") : "";
    const code = codeRaw || null;

    let login = (h.login !== undefined ? cell(row, h.login) : "").trim().toLowerCase().replace(/\s/g, "");
    if (!login) login = suggestLogin(kind, code || "", fioRaw).toLowerCase();

    const passwordRaw = h.password !== undefined ? cell(row, h.password) : "";
    const phone = h.phone !== undefined ? cell(row, h.phone) || null : null;
    const pinfl = normPinfl(h.pinfl !== undefined ? cell(row, h.pinfl) : null);
    const email = h.email !== undefined ? cell(row, h.email) || null : null;
    const product = h.product !== undefined ? cell(row, h.product) || null : null;
    const agent_type = h.agentType !== undefined ? cell(row, h.agentType) || null : null;
    const position = h.position !== undefined ? cell(row, h.position) || null : null;
    const branch = h.branch !== undefined ? cell(row, h.branch) || null : null;
    const trade_direction = h.tradeDirection !== undefined ? cell(row, h.tradeDirection) || null : null;
    const territory = h.territory !== undefined ? cell(row, h.territory) || null : null;

    const appRaw = h.appAccess !== undefined ? cell(row, h.appAccess) : "";
    const app_access = appRaw.trim() === "" ? kind === "operator" || kind === "skladchik" ? false : true : yesRu(appRaw);

    let max_sessions = kind === "operator" || kind === "skladchik" ? 1 : 2;
    if (h.maxSessions !== undefined) {
      const n = Number(cell(row, h.maxSessions));
      if (Number.isFinite(n) && n >= 1 && n <= 99) max_sessions = Math.floor(n);
    }

    const createKind: StaffKind =
      kind === "operator"
        ? parseOperatorWebKind(
            (h.webRole !== undefined ? cell(row, h.webRole) : "").trim() ||
              (opts?.defaultWebRole ?? "")
          )
        : (kind as StaffKind);

    const workSlotCode = h.workSlot !== undefined ? cell(row, h.workSlot) : "";
    let work_slot_id: number | null = null;
    if (workSlotCode.trim()) {
      work_slot_id = await resolveWorkSlotIdByCode(tenantId, workSlotCode, kind, {
        slotType: createKind
      });
      if (work_slot_id == null) {
        const inactive = await isWorkSlotInactive(tenantId, workSlotCode, createKind);
        pushErr(
          excelRow,
          inactive
            ? `рабочее место «${workSlotCode.trim()}» неактивно — активируйте его в «Рабочие места»`
            : `рабочее место не найдено «${workSlotCode.trim()}» (роль ${createKind})`
        );
        continue;
      }
    } else if (needsWorkSlot) {
      pushErr(excelRow, "требуется рабочее место (колонка «Рабочее место»)");
      continue;
    }

    let warehouse_id: number | null | undefined;
    if (h.warehouse !== undefined) {
      const warehouseRaw = cell(row, h.warehouse);
      if (warehouseRaw.trim()) {
        const resolved = await resolveWarehouseIdByName(tenantId, warehouseRaw);
        if (resolved.id == null) {
          pushErr(excelRow, `склад не найден «${resolved.tried[0] ?? warehouseRaw}»`);
          continue;
        }
        warehouse_id = resolved.id;
      }
    }

    let warehouse_ids: number[] | undefined;
    const warehousesRaw =
      h.warehouses !== undefined
        ? cell(row, h.warehouses)
        : kind === "skladchik" && h.warehouse !== undefined
          ? cell(row, h.warehouse)
          : "";
    if (kind === "skladchik" && warehousesRaw.trim()) {
      const resolved = await resolveWarehouseIdsByNames(tenantId, warehousesRaw);
      if (resolved.missing.length) {
        pushErr(excelRow, `склады не найдены: ${resolved.missing.join(", ")}`);
        continue;
      }
      warehouse_ids = resolved.ids;
      if (warehouse_ids.length && warehouse_id == null) warehouse_id = warehouse_ids[0];
    }

    let supervisee_agent_ids: number[] | undefined;
    if (kind === "supervisor" && h.agentsCol !== undefined) {
      const agentsRaw = cell(row, h.agentsCol);
      if (agentsRaw.trim()) {
        const existingForTeam = await findExistingStaffUser(tenantId, kind, login, code);
        let skipTeamImport = work_slot_id != null;
        if (!skipTeamImport && existingForTeam) {
          const { getActiveSlotForUser } = await import("../work-slots/work-slots.query.read");
          const active = await getActiveSlotForUser(existingForTeam.id);
          skipTeamImport = active != null;
        }
        if (skipTeamImport) {
          pushErr(
            excelRow,
            "агенты (колонка) пропущены: команда настраивается в Рабочее место → Команда"
          );
        } else {
          const resolved = await resolveAgentIdsFromCell(tenantId, agentsRaw);
          if (resolved.missing.length) {
            pushErr(
              excelRow,
              `агенты не найдены: ${resolved.missing.slice(0, 5).join(", ")}${resolved.missing.length > 5 ? "…" : ""}`
            );
          }
          supervisee_agent_ids = resolved.ids;
        }
      }
    }

    try {
      const existing = await findExistingStaffUser(tenantId, kind, login, code);

      if (existing) {
        const patch: Record<string, unknown> = {
          first_name,
          last_name,
          middle_name,
          phone,
          pinfl,
          position,
          branch,
          app_access,
          max_sessions
        };
        if (email !== undefined && email !== null) patch.email = email;
        if (product != null) patch.product = product;
        if (agent_type != null) patch.agent_type = agent_type;
        if (code != null) patch.code = code;
        if (trade_direction != null) patch.trade_direction = trade_direction;
        if (territory != null) patch.territory = territory;
        if (warehouse_id !== undefined) patch.warehouse_id = warehouse_id;
        if (warehouse_ids !== undefined) patch.warehouse_ids = warehouse_ids;
        if (supervisee_agent_ids !== undefined) patch.supervisee_agent_ids = supervisee_agent_ids;
        if (passwordRaw.trim().length >= 6) patch.password = passwordRaw.trim();
        await applyPatch(tenantId, kind, existing.id, patch, actorUserId);

        if (work_slot_id != null && STAFF_KINDS_WITH_WORK_SLOT.has(kind as StaffKind)) {
          const { assignUserToSlot } = await import("../work-slots/work-slots.assign");
          await assignUserToSlot(tenantId, work_slot_id, existing.id, actorUserId, "Импорт из Excel");
        }

        updated++;
      } else {
        const password = passwordRaw.trim().length >= 6 ? passwordRaw.trim() : defaultPassword;
        if (password.length < 6) {
          pushErr(excelRow, "пароль меньше 6 символов");
          continue;
        }

        const input: CreateStaffInput = {
          first_name,
          last_name,
          middle_name,
          login,
          password,
          phone,
          email,
          product,
          agent_type,
          code,
          pinfl,
          warehouse_id: warehouse_id ?? null,
          warehouse_ids,
          trade_direction,
          branch,
          position,
          app_access,
          territory,
          max_sessions,
          work_slot_id,
          is_active: true,
          can_authorize: true
        };

        const createdRow = await createStaff(tenantId, createKind, input, actorUserId);

        if (supervisee_agent_ids !== undefined && kind === "supervisor") {
          await patchSupervisor(
            tenantId,
            createdRow.id,
            { supervisee_agent_ids },
            actorUserId
          );
        }

        created++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ошибка";
      pushErr(excelRow, mapCreateError(msg));
    }
  }

  return {
    created,
    updated,
    errors,
    importStats: {
      totalRows: dataRows.length,
      processedRows,
      skippedEmpty
    }
  };
}

/**
 * Single-kind import from XLSX.
 * If the workbook has multiple sheets, prefers the sheet matching `STAFF_IMPORT_SHEET_NAME[kind]`,
 * otherwise falls back to the first sheet (backward compatible).
 * Optional `sheetName` forces a specific sheet when present.
 */
export async function importStaffFromXlsxBuffer(
  tenantId: number,
  kind: StaffImportKind,
  buffer: Buffer,
  actorUserId: number | null = null,
  opts?: { defaultPassword?: string; sheetName?: string; defaultWebRole?: string }
): Promise<StaffImportResult> {
  let matrix: unknown[][];
  let defaultWebRole = opts?.defaultWebRole;
  if (opts?.sheetName?.trim()) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
    const want = opts.sheetName.trim();
    const found =
      wb.SheetNames.find((n) => n === want) ??
      wb.SheetNames.find((n) => n.toLowerCase() === want.toLowerCase());
    if (!found || !wb.Sheets[found]) throw new Error("EMPTY_FILE");
    matrix = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[found], { header: 1, defval: "" });
    if (!defaultWebRole) {
      const { resolveOfficeWebRoleFromSheetName } = await import("./staff.import.kinds");
      defaultWebRole = resolveOfficeWebRoleFromSheetName(found) ?? undefined;
    }
  } else {
    ({ matrix } = readMatrixForKindFromBuffer(buffer, kind));
  }
  return importStaffFromMatrix(tenantId, kind, matrix, actorUserId, {
    defaultPassword: opts?.defaultPassword,
    defaultWebRole
  });
}

/** Import every recognized role sheet in a multi-sheet workbook. */
export async function importStaffWorkbookFromXlsxBuffer(
  tenantId: number,
  buffer: Buffer,
  actorUserId: number | null = null,
  opts?: { defaultPassword?: string }
): Promise<StaffWorkbookImportResult> {
  const sheets = readAllStaffSheetsFromBuffer(buffer);
  if (sheets.length === 0) {
    throw new Error("EMPTY_FILE");
  }

  const byKind: Partial<Record<StaffImportKind, StaffImportResult>> = {};
  let created = 0;
  let updated = 0;
  let totalRows = 0;
  let processedRows = 0;
  let skippedEmpty = 0;
  const errors: string[] = [];

  for (const sheet of sheets) {
    const label = sheet.sheetName || STAFF_IMPORT_SHEET_NAME[sheet.kind];
    try {
      const result = await importStaffFromMatrix(
        tenantId,
        sheet.kind,
        sheet.matrix,
        actorUserId,
        {
          defaultPassword: opts?.defaultPassword,
          errorPrefix: `[${label}] `,
          defaultWebRole: sheet.defaultWebRole
        }
      );
      const prev = byKind[sheet.kind];
      if (prev) {
        byKind[sheet.kind] = {
          created: prev.created + result.created,
          updated: prev.updated + result.updated,
          errors: [...prev.errors, ...result.errors].slice(0, STAFF_IMPORT_MAX_ERRORS),
          importStats: {
            totalRows: prev.importStats.totalRows + result.importStats.totalRows,
            processedRows: prev.importStats.processedRows + result.importStats.processedRows,
            skippedEmpty: prev.importStats.skippedEmpty + result.importStats.skippedEmpty
          }
        };
      } else {
        byKind[sheet.kind] = result;
      }
      created += result.created;
      updated += result.updated;
      totalRows += result.importStats.totalRows;
      processedRows += result.importStats.processedRows;
      skippedEmpty += result.importStats.skippedEmpty;
      for (const e of result.errors) {
        if (errors.length >= STAFF_IMPORT_MAX_ERRORS) break;
        errors.push(e);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ошибка";
      if (msg === "EMPTY_FILE" || msg === "MISSING_FIO_COLUMN") {
        // empty / header-only sheet — skip quietly
        continue;
      }
      if (errors.length < STAFF_IMPORT_MAX_ERRORS) {
        errors.push(`[${label}] ${msg === "TOO_MANY_ROWS" ? "слишком много строк" : msg}`);
      }
    }
  }

  if (created === 0 && updated === 0 && Object.keys(byKind).length === 0 && errors.length === 0) {
    throw new Error("EMPTY_FILE");
  }

  return {
    created,
    updated,
    errors,
    byKind,
    importStats: { totalRows, processedRows, skippedEmpty }
  };
}
