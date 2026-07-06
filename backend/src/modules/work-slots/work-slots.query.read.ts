import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SlotHistoryRow, WorkSlotRow } from "./work-slots.types";
import { mapSlotRow, slotInclude } from "./work-slots.query.helpers";
import { buildListWhere, type ListWorkSlotsFilters } from "./work-slots.query.filters";

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

  return { data: rows.map(mapSlotRow), total };
}

export async function getWorkSlotDetail(tenantId: number, slotId: number): Promise<WorkSlotRow | null> {
  const row = await prisma.workSlot.findFirst({
    where: { id: slotId, tenant_id: tenantId },
    include: slotInclude
  });
  return row ? mapSlotRow(row) : null;
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

export type ActiveWorkSlotInfo = { slot_id: number; slot_code: string };

/** Faol `slot_user_links` bo‘yicha foydalanuvchi → ishchi o‘rni. */
export async function loadActiveWorkSlotsByUserIds(
  userIds: number[]
): Promise<Map<number, ActiveWorkSlotInfo>> {
  if (userIds.length === 0) return new Map();
  const links = await prisma.slotUserLink.findMany({
    where: { user_id: { in: userIds }, ended_at: null },
    select: {
      user_id: true,
      slot: { select: { id: true, slot_code: true } }
    }
  });
  const map = new Map<number, ActiveWorkSlotInfo>();
  for (const l of links) {
    map.set(l.user_id, { slot_id: l.slot.id, slot_code: l.slot.slot_code });
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
