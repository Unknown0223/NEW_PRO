import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SlotOccupancySegment } from "./work-slots.plan-policy";

type Tx = Prisma.TransactionClient | typeof prisma;

/**
 * Agentlar uchun oyga tegishli `slot_user_links` (agent slotlari).
 * Natija: user_id → segmentlar.
 */
export async function loadAgentSlotOccupancyForMonth(
  tenantId: number,
  agentIds: number[],
  monthStart: Date,
  monthEnd: Date,
  db: Tx = prisma
): Promise<Map<number, SlotOccupancySegment[]>> {
  const out = new Map<number, SlotOccupancySegment[]>();
  if (agentIds.length === 0) return out;

  const links = await db.slotUserLink.findMany({
    where: {
      tenant_id: tenantId,
      user_id: { in: agentIds },
      started_at: { lt: monthEnd },
      OR: [{ ended_at: null }, { ended_at: { gte: monthStart } }],
      slot: { tenant_id: tenantId, slot_type: "agent" }
    },
    select: { user_id: true, started_at: true, ended_at: true }
  });

  for (const l of links) {
    const list = out.get(l.user_id) ?? [];
    list.push({ started_at: l.started_at, ended_at: l.ended_at });
    out.set(l.user_id, list);
  }
  return out;
}

/** Oy ichida slotdan chiqqan (ended_at) eng kech sana — tabel bloklash uchun. */
export async function loadSlotLeaveDatesForMonth(
  tenantId: number,
  monthStart: Date,
  monthEnd: Date,
  userIds?: number[]
): Promise<Map<number, string>> {
  const links = await prisma.slotUserLink.findMany({
    where: {
      tenant_id: tenantId,
      ...(userIds?.length ? { user_id: { in: userIds } } : {}),
      ended_at: { gte: monthStart, lt: monthEnd },
      started_at: { lt: monthEnd }
    },
    select: { user_id: true, ended_at: true },
    orderBy: { ended_at: "desc" }
  });

  const out = new Map<number, string>();
  for (const l of links) {
    if (!l.ended_at || out.has(l.user_id)) continue;
    out.set(l.user_id, l.ended_at.toISOString().slice(0, 10));
  }
  return out;
}

/** Oyda slotda bo‘lgan, lekin hozir faol linki yo‘q user_id lar (tabel pastiga). */
export async function listDepartedSlotUserIdsInMonth(
  tenantId: number,
  monthStart: Date,
  monthEnd: Date
): Promise<number[]> {
  const links = await prisma.slotUserLink.findMany({
    where: {
      tenant_id: tenantId,
      ended_at: { gte: monthStart, lt: monthEnd },
      started_at: { lt: monthEnd }
    },
    select: { user_id: true }
  });
  const departed = new Set(links.map((l) => l.user_id));
  if (departed.size === 0) return [];

  const stillActive = await prisma.slotUserLink.findMany({
    where: {
      tenant_id: tenantId,
      user_id: { in: [...departed] },
      ended_at: null
    },
    select: { user_id: true }
  });
  const activeNow = new Set(stillActive.map((l) => l.user_id));
  return [...departed].filter((id) => !activeNow.has(id));
}

/**
 * Табельga tushadigan userlar (shu oy):
 * - oyda slotga birikkan (faol yoki chiqqan), yoki
 * - oyda akkaunt faolligi (vizit / refresh session).
 * `departedIds` — hozir faol sloti yo‘q (qizil + qotirilgan).
 */
export async function listTimesheetEligibleUserIdsInMonth(
  tenantId: number,
  monthStart: Date,
  monthEnd: Date
): Promise<{ eligibleIds: number[]; departedIds: number[]; activeSlotIds: number[] }> {
  const [slotLinks, visits, sessions] = await Promise.all([
    prisma.slotUserLink.findMany({
      where: {
        tenant_id: tenantId,
        started_at: { lt: monthEnd },
        OR: [{ ended_at: null }, { ended_at: { gte: monthStart } }]
      },
      select: { user_id: true, ended_at: true }
    }),
    prisma.agentVisit.findMany({
      where: {
        tenant_id: tenantId,
        checked_in_at: { gte: monthStart, lt: monthEnd }
      },
      select: { agent_id: true },
      distinct: ["agent_id"]
    }),
    prisma.refreshToken.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: monthStart, lt: monthEnd }
      },
      select: { user_id: true },
      distinct: ["user_id"]
    })
  ]);

  const eligible = new Set<number>();
  for (const l of slotLinks) eligible.add(l.user_id);
  for (const v of visits) eligible.add(v.agent_id);
  for (const s of sessions) eligible.add(s.user_id);

  const activeSlotRows =
    eligible.size === 0
      ? []
      : await prisma.slotUserLink.findMany({
          where: {
            tenant_id: tenantId,
            ended_at: null,
            user_id: { in: [...eligible] }
          },
          select: { user_id: true }
        });
  const activeSlotIds = [...new Set(activeSlotRows.map((r) => r.user_id))];
  const activeNow = new Set(activeSlotIds);

  const departedIds = [...eligible].filter((id) => !activeNow.has(id));
  return { eligibleIds: [...eligible], departedIds, activeSlotIds };
}
