import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SlotHistoryRow, WorkSlotRow } from "./work-slots.types";
import {
  mapSlotRow,
  slotInclude,
  type SlotNameLookups,
  type SlotRowSource
} from "./work-slots.query.helpers";
import { buildListWhere, type ListWorkSlotsFilters } from "./work-slots.query.filters";
import {
  effectiveCashDeskIds,
  effectiveWarehouseIds
} from "./work-slots.multi-bindings";

async function loadSlotNameLookups(
  tenantId: number,
  rows: SlotRowSource[]
): Promise<SlotNameLookups> {
  const warehouseIds = new Set<number>();
  const cashDeskIds = new Set<number>();
  for (const row of rows) {
    for (const id of effectiveWarehouseIds(row)) warehouseIds.add(id);
    for (const id of effectiveCashDeskIds(row)) cashDeskIds.add(id);
  }
  const [warehouses, cashDesks] = await Promise.all([
    warehouseIds.size > 0
      ? prisma.warehouse.findMany({
          where: { tenant_id: tenantId, id: { in: [...warehouseIds] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([]),
    cashDeskIds.size > 0
      ? prisma.cashDesk.findMany({
          where: { tenant_id: tenantId, id: { in: [...cashDeskIds] } },
          select: { id: true, name: true }
        })
      : Promise.resolve([])
  ]);
  return {
    warehouseNames: new Map(warehouses.map((w) => [w.id, w.name])),
    cashDeskNames: new Map(cashDesks.map((c) => [c.id, c.name]))
  };
}

async function attachActiveSessionCounts(tenantId: number, data: WorkSlotRow[]): Promise<void> {
  const userIds = [
    ...new Set(data.map((r) => r.active_user_id).filter((id): id is number => id != null && id > 0))
  ];
  for (const row of data) {
    row.active_user_active_session_count = 0;
  }
  if (userIds.length === 0) return;
  const sessionCounts = await prisma.refreshToken.groupBy({
    by: ["user_id"],
    where: {
      tenant_id: tenantId,
      user_id: { in: userIds },
      revoked_at: null,
      expires_at: { gt: new Date() }
    },
    _count: { _all: true }
  });
  const sessMap = new Map(sessionCounts.map((s) => [s.user_id, s._count._all]));
  for (const row of data) {
    if (row.active_user_id == null) continue;
    row.active_user_active_session_count = sessMap.get(row.active_user_id) ?? 0;
  }
}

export async function listWorkSlots(
  tenantId: number,
  filters: ListWorkSlotsFilters
): Promise<{ data: WorkSlotRow[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const where = buildListWhere(tenantId, filters);

  const [rows, total] = await Promise.all([
    prisma.workSlot.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sort_order: "asc" }, { slot_code: "asc" }],
      include: slotInclude
    }),
    prisma.workSlot.count({ where })
  ]);

  const lookups = await loadSlotNameLookups(tenantId, rows as SlotRowSource[]);
  const data = rows.map((r) => mapSlotRow(r as SlotRowSource, lookups));
  await attachActiveSessionCounts(tenantId, data);
  const activeUserIds = [
    ...new Set(data.map((r) => r.active_user_id).filter((id): id is number => id != null && id > 0))
  ];
  if (activeUserIds.length > 0) {
    const { REF_KEY, readUiPrefs } = await import("../mobile/mobile-face.shared");
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: activeUserIds } },
      select: { id: true, ui_preferences: true }
    });
    const faceByUser = new Map<number, boolean>();
    for (const u of users) {
      const key = readUiPrefs(u.ui_preferences)[REF_KEY];
      faceByUser.set(u.id, typeof key === "string" && key.length > 0);
    }
    for (const row of data) {
      if (row.active_user_id == null) continue;
      const has = faceByUser.get(row.active_user_id) === true;
      row.active_user_has_face_reference = has;
      row.active_user_face_user_id = has ? row.active_user_id : null;
    }
  }

  return { data, total };
}

export async function getWorkSlotDetail(tenantId: number, slotId: number): Promise<WorkSlotRow | null> {
  const row = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    include: slotInclude
  });
  if (!row) return null;
  const lookups = await loadSlotNameLookups(tenantId, [row as SlotRowSource]);
  const mapped = mapSlotRow(row as SlotRowSource, lookups);
  await attachActiveSessionCounts(tenantId, [mapped]);
  if (mapped.active_user_id != null) {
    const { getFaceReferenceMeta } = await import("../mobile/mobile-face.service");
    const face = await getFaceReferenceMeta(tenantId, mapped.active_user_id);
    mapped.active_user_has_face_reference = face.has_reference;
    mapped.active_user_face_user_id = face.has_reference ? mapped.active_user_id : null;
  }
  return mapped;
}

export async function getSlotHistory(
  tenantId: number,
  slotId: number,
  page = 1,
  limit = 50
): Promise<{ data: SlotHistoryRow[]; total: number }> {
  const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
  const take = Math.min(100, Math.max(1, limit));

  const slot = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!slot) throw new Error("NOT_FOUND");

  const [entries, total] = await Promise.all([
    prisma.slotAuditEntry.findMany({
      where: { tenant_id: tenantId, slot_id: slotId },
      skip,
      take,
      orderBy: { created_at: "desc" },
      include: {
        actor: { select: { name: true } }
      }
    }),
    prisma.slotAuditEntry.count({ where: { tenant_id: tenantId, slot_id: slotId } })
  ]);

  const userIds = new Set<number>();
  for (const e of entries) {
    if (e.prev_user_id != null) userIds.add(e.prev_user_id);
    if (e.next_user_id != null) userIds.add(e.next_user_id);
  }
  const users =
    userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...userIds] } },
          select: { id: true, name: true }
        })
      : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return {
    data: entries.map((e) => ({
      id: e.id,
      prev_user_id: e.prev_user_id,
      prev_user_name: e.prev_user_id != null ? nameById.get(e.prev_user_id) ?? null : null,
      next_user_id: e.next_user_id,
      next_user_name: e.next_user_id != null ? nameById.get(e.next_user_id) ?? null : null,
      action: e.action,
      actor_name: e.actor?.name ?? null,
      note: e.note,
      created_at: e.created_at.toISOString()
    })),
    total
  };
}

/**
 * Slotda ishlagan (yoki hozirgi) agentlar: unpaid delivered qarzlari borlarining ro‘yxati (nom + summa).
 */
export async function listSlotDebtCollectors(
  tenantId: number,
  slotId: number
): Promise<
  Array<{
    user_id: number;
    name: string;
    is_active: boolean;
    on_active_slot: boolean;
    unpaid: string;
  }>
> {
  const slot = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    select: { id: true }
  });
  if (!slot) throw new Error("NOT_FOUND");

  const links = await prisma.slotUserLink.findMany({
    where: { tenant_id: tenantId, slot_id: slotId },
    select: { user_id: true },
    distinct: ["user_id"]
  });
  const audits = await prisma.slotAuditEntry.findMany({
    where: { tenant_id: tenantId, slot_id: slotId },
    select: { prev_user_id: true, next_user_id: true }
  });
  const userIds = new Set<number>();
  for (const l of links) userIds.add(l.user_id);
  for (const a of audits) {
    if (a.prev_user_id != null) userIds.add(a.prev_user_id);
    if (a.next_user_id != null) userIds.add(a.next_user_id);
  }
  if (userIds.size === 0) return [];

  const { sumUnpaidDeliveredRemainderForAgent } = await import(
    "../client-balances/client-debt-by-agent"
  );

  const users = await prisma.user.findMany({
    where: { tenant_id: tenantId, id: { in: [...userIds] }, role: "agent" },
    select: { id: true, name: true, is_active: true }
  });

  const activeLinks = await prisma.slotUserLink.findMany({
    where: { tenant_id: tenantId, user_id: { in: users.map((u) => u.id) }, ended_at: null },
    select: { user_id: true }
  });
  const onSlot = new Set(activeLinks.map((l) => l.user_id));

  const out: Array<{
    user_id: number;
    name: string;
    is_active: boolean;
    on_active_slot: boolean;
    unpaid: string;
  }> = [];

  for (const u of users) {
    const unpaid = await sumUnpaidDeliveredRemainderForAgent(tenantId, u.id);
    if (!unpaid.gt(0.01)) continue;
    out.push({
      user_id: u.id,
      name: u.name?.trim() || `#${u.id}`,
      is_active: u.is_active,
      on_active_slot: onSlot.has(u.id),
      unpaid: unpaid.toString()
    });
  }

  out.sort((a, b) => Number(b.unpaid) - Number(a.unpaid));
  return out;
}

export type ActiveWorkSlotInfo = {
  slot_id: number;
  slot_code: string;
  consignment: boolean;
  consignment_limit_amount: import("@prisma/client").Prisma.Decimal | null;
  consignment_ignore_previous_months_debt: boolean;
  consignment_close_day: number;
  consignment_close_hour: number;
  consignment_close_minute: number;
};

/** Faol `slot_user_links` bo‘yicha foydalanuvchi → ishchi o‘rni (+ konsignatsiya maydonlari). */
export async function loadActiveWorkSlotsByUserIds(
  userIds: number[]
): Promise<Map<number, ActiveWorkSlotInfo>> {
  if (userIds.length === 0) return new Map();
  const links = await prisma.slotUserLink.findMany({
    where: { user_id: { in: userIds }, ended_at: null },
    select: {
      user_id: true,
      slot: {
        select: {
          id: true,
          slot_code: true,
          consignment: true,
          consignment_limit_amount: true,
          consignment_ignore_previous_months_debt: true,
          consignment_close_day: true,
          consignment_close_hour: true,
          consignment_close_minute: true
        }
      }
    }
  });
  const map = new Map<number, ActiveWorkSlotInfo>();
  for (const l of links) {
    map.set(l.user_id, {
      slot_id: l.slot.id,
      slot_code: l.slot.slot_code,
      consignment: l.slot.consignment,
      consignment_limit_amount: l.slot.consignment_limit_amount,
      consignment_ignore_previous_months_debt: l.slot.consignment_ignore_previous_months_debt,
      consignment_close_day: l.slot.consignment_close_day,
      consignment_close_hour: l.slot.consignment_close_hour,
      consignment_close_minute: l.slot.consignment_close_minute
    });
  }
  return map;
}

export async function getActiveSlotForUser(
  userId: number
): Promise<{ slot_id: number; slot_code: string } | null> {
  if (!Number.isFinite(userId) || userId < 1) return null;
  const map = await loadActiveWorkSlotsByUserIds([userId]);
  return map.get(userId) ?? null;
}

/** Agent kodi boshqa xodimning faol slotida band bo‘lsa — ogohlantirish matni. */
export async function getWorkSlotCodeOccupancyWarning(
  tenantId: number,
  userId: number,
  code: string | null | undefined
): Promise<string | null> {
  const trimmed = code?.trim();
  if (!trimmed) return null;
  const slot = await prisma.workSlot.findFirst({
    where: { tenant_id: tenantId, slot_code: trimmed.toUpperCase() },
    select: { id: true, slot_code: true }
  });
  if (!slot) return null;
  const link = await prisma.slotUserLink.findFirst({
    where: { slot_id: slot.id, ended_at: null },
    select: { user_id: true, user: { select: { name: true } } }
  });
  if (!link || link.user_id === userId) return null;
  return `Kod «${slot.slot_code}» boshqa xodimga (${link.user.name}) biriktirilgan slotda band`;
}
