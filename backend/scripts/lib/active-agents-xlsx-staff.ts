import bcrypt from "bcryptjs";
import { Prisma, type PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import {
  AGENT_HEADER_ALIASES,
  EXPEDITOR_HEADER_ALIASES,
  SUPERVISOR_HEADER_ALIASES,
  buildHeaderMap,
  normHeader
} from "./active-agents-xlsx-header";

export type StaffRole = "agent" | "expeditor" | "supervisor";

export type StaffRowData = {
  name: string;
  first_name: string;
  last_name: string | null;
  code: string | null;
  phone: string | null;
  pinfl: string | null;
  consignment: boolean;
  apk_version: string | null;
  device_name: string | null;
  last_sync_at: Date | null;
  price_type: string | null;
  warehouse_id: number | null;
  disconnectWarehouse: boolean;
  trade_direction: string | null;
  territory: string | null;
  branch: string | null;
  position: string | null;
  app_access: boolean;
  max_sessions: number;
  role: StaffRole;
};

export async function upsertStaffUser(
  prisma: PrismaClient,
  tenantId: number,
  login: string,
  dry: boolean,
  resetPassword: boolean,
  defaultPassword: string,
  row: StaffRowData
): Promise<{ created: boolean; updated: boolean; dryLine?: string }> {
  const existing =
    (await prisma.user.findFirst({
      where: { tenant_id: tenantId, login }
    })) ||
    (row.code
      ? await prisma.user.findFirst({
          where: { tenant_id: tenantId, code: row.code }
        })
      : null);

  if (dry) {
    return { created: false, updated: false, dryLine: `[dry] ${login} ${row.code ?? ""} | ${row.name}` };
  }

  const warehouseConnect =
    row.warehouse_id != null
      ? { connect: { id: row.warehouse_id } }
      : row.disconnectWarehouse
        ? { disconnect: true }
        : undefined;

  if (existing) {
    const updatePayload: Prisma.UserUpdateInput = {
      name: row.name,
      first_name: row.first_name,
      last_name: row.last_name,
      code: row.code,
      phone: row.phone,
      pinfl: row.pinfl,
      consignment: row.consignment,
      apk_version: row.apk_version,
      device_name: row.device_name,
      last_sync_at: row.last_sync_at,
      price_type: row.price_type,
      trade_direction: row.trade_direction,
      territory: row.territory,
      branch: row.branch,
      position: row.position,
      app_access: row.app_access,
      max_sessions: row.max_sessions,
      role: row.role,
      is_active: true,
      can_authorize: true
    };
    if (warehouseConnect !== undefined) updatePayload.warehouse = warehouseConnect;
    if (existing.login !== login) updatePayload.login = login;
    if (resetPassword) updatePayload.password_hash = await bcrypt.hash(defaultPassword, 10);
    await prisma.user.update({
      where: { id: existing.id },
      data: updatePayload
    });
    return { created: false, updated: true };
  }

  const password_hash = await bcrypt.hash(defaultPassword, 10);
  await prisma.user.create({
    data: {
      tenant_id: tenantId,
      login,
      password_hash,
      name: row.name,
      first_name: row.first_name,
      last_name: row.last_name,
      code: row.code,
      phone: row.phone,
      pinfl: row.pinfl,
      consignment: row.consignment,
      apk_version: row.apk_version,
      device_name: row.device_name,
      last_sync_at: row.last_sync_at,
      price_type: row.price_type,
      warehouse_id: row.warehouse_id ?? undefined,
      trade_direction: row.trade_direction,
      territory: row.territory,
      branch: row.branch,
      position: row.position,
      app_access: row.app_access,
      max_sessions: row.max_sessions,
      role: row.role,
      is_active: true,
      can_authorize: true
    }
  });
  return { created: true, updated: false };
}

export function readMatrix(abs: string): { sheetName: string; matrix: unknown[][] } {
  const wb = XLSX.readFile(abs, { cellDates: true, raw: true });
  const sheetName = wb.SheetNames[0] || "Sheet1";
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  return { sheetName, matrix };
}

export type StaffImportXlsxKind = "agent" | "expeditor" | "supervisor";

const STAFF_KIND_TO_ALIASES: Record<StaffImportXlsxKind, Record<string, string[]>> = {
  agent: AGENT_HEADER_ALIASES,
  expeditor: EXPEDITOR_HEADER_ALIASES,
  supervisor: SUPERVISOR_HEADER_ALIASES
};

/** CLI / tahlil: 1-qator ustunlari import bilan qanday maylonga tushishini ko‘rsatadi */
export function debugStaffImportHeaderMap(
  headerRow: unknown[],
  kind: StaffImportXlsxKind
): { fieldToColumnIndex: Record<string, number>; normalizedCells: string[] } {
  const fieldToColumnIndex = buildHeaderMap(headerRow, STAFF_KIND_TO_ALIASES[kind]);
  const normalizedCells = (headerRow as unknown[]).map((c) => normHeader(c == null ? "" : String(c)));
  return { fieldToColumnIndex, normalizedCells };
}

