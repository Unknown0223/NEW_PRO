/**
 * Staff Excel import — resolve refs (warehouse, work slot, agents).
 */

import { prisma } from "../../config/database";
import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";
import type { StaffImportKind } from "./staff.import.kinds";
import { kindRole } from "./staff.shared";
import type { StaffKind } from "./staff.shared";

export async function resolveWarehouseIdByName(
  tenantId: number,
  raw: string
): Promise<{ id: number | null; tried: string[] }> {
  const tried: string[] = [];
  if (!raw.trim()) return { id: null, tried };
  for (const part of raw.split(/[,;]/)) {
    const name = part.trim();
    if (!name) continue;
    tried.push(name);
    const wh = await prisma.warehouse.findFirst({
      where: { tenant_id: tenantId, name: { equals: name, mode: "insensitive" } },
      select: { id: true }
    });
    if (wh) return { id: wh.id, tried };
  }
  return { id: null, tried };
}

export async function resolveWarehouseIdsByNames(
  tenantId: number,
  raw: string
): Promise<{ ids: number[]; missing: string[] }> {
  const ids: number[] = [];
  const missing: string[] = [];
  const seen = new Set<number>();
  for (const part of raw.split(/[,;]/)) {
    const name = part.trim();
    if (!name) continue;
    const wh = await prisma.warehouse.findFirst({
      where: { tenant_id: tenantId, name: { equals: name, mode: "insensitive" } },
      select: { id: true }
    });
    if (!wh) {
      missing.push(name);
      continue;
    }
    if (!seen.has(wh.id)) {
      seen.add(wh.id);
      ids.push(wh.id);
    }
  }
  return { ids, missing };
}

export async function resolveWorkSlotIdByCode(
  tenantId: number,
  slotCode: string,
  _kind: StaffImportKind,
  opts?: { slotType?: string | null }
): Promise<number | null> {
  const code = slotCode.trim().toUpperCase();
  if (!code) return null;
  const slot = await prisma.workSlot.findFirst({
    where: {
      tenant_id: tenantId,
      slot_code: { equals: code, mode: "insensitive" },
      is_active: true,
      deleted_at: null,
      ...(opts?.slotType ? { slot_type: opts.slotType } : {})
    },
    select: { id: true }
  });
  return slot?.id ?? null;
}

export async function isWorkSlotInactive(
  tenantId: number,
  slotCode: string,
  slotType?: string | null
): Promise<boolean> {
  const code = slotCode.trim().toUpperCase();
  if (!code) return false;
  const slot = await prisma.workSlot.findFirst({
    where: {
      tenant_id: tenantId,
      slot_code: { equals: code, mode: "insensitive" },
      is_active: false,
      deleted_at: null,
      ...(slotType ? { slot_type: slotType } : {})
    },
    select: { id: true }
  });
  return slot != null;
}

export function splitListCell(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function resolveAgentIdsFromCell(
  tenantId: number,
  raw: string
): Promise<{ ids: number[]; missing: string[] }> {
  const tokens = splitListCell(raw);
  const ids: number[] = [];
  const missing: string[] = [];
  const seen = new Set<number>();

  for (const token of tokens) {
    const code = token.toUpperCase().replace(/\s+/g, "");
    let agent = await prisma.user.findFirst({
      where: { tenant_id: tenantId, role: "agent", code: { equals: code, mode: "insensitive" } },
      select: { id: true }
    });
    if (!agent) {
      agent = await prisma.user.findFirst({
        where: {
          tenant_id: tenantId,
          role: "agent",
          OR: [
            { login: { equals: token.toLowerCase(), mode: "insensitive" } },
            { name: { equals: token, mode: "insensitive" } },
            { first_name: { equals: token, mode: "insensitive" } }
          ]
        },
        select: { id: true }
      });
    }
    if (!agent) {
      missing.push(token);
      continue;
    }
    if (!seen.has(agent.id)) {
      seen.add(agent.id);
      ids.push(agent.id);
    }
  }
  return { ids, missing };
}

export function parseOperatorWebKind(raw: string): StaffKind {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return "operator";
  const map: Record<string, StaffKind> = {
    operator: "operator",
    оператор: "operator",
    director: "director",
    директор: "director",
    sales_director: "sales_director",
    директор_по_продажам: "sales_director",
    менеджер: "manager",
    manager: "manager",
    regional_manager: "regional_manager",
    региональный_менеджер: "regional_manager",
    accountant: "accountant",
    бухгалтер: "accountant",
    warehouse_manager: "warehouse_manager",
    менеджер_склада: "warehouse_manager"
  };
  const mapped = map[s] ?? (s as StaffKind);
  if ((OPERATOR_LIKE_WEB_ROLES as readonly string[]).includes(mapped)) return mapped;
  return "operator";
}

export async function findExistingStaffUser(
  tenantId: number,
  kind: StaffImportKind,
  login: string,
  code: string | null
): Promise<{ id: number; login: string } | null> {
  const role = kind === "operator" ? undefined : kindRole(kind as StaffKind);
  const byLogin = await prisma.user.findFirst({
    where: {
      tenant_id: tenantId,
      login,
      ...(role
        ? { role }
        : { role: { in: [...OPERATOR_LIKE_WEB_ROLES] } })
    },
    select: { id: true, login: true }
  });
  if (byLogin) return byLogin;
  if (!code) return null;
  return prisma.user.findFirst({
    where: {
      tenant_id: tenantId,
      code,
      ...(role
        ? { role }
        : { role: { in: [...OPERATOR_LIKE_WEB_ROLES] } })
    },
    select: { id: true, login: true }
  });
}
