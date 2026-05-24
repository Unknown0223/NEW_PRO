import { prisma } from "../../config/database";

export type WorkSlotActivityRow = {
  link_id: number;
  slot_id: number;
  slot_code: string;
  slot_type: string;
  branch_code: string | null;
  user_id: number;
  user_name: string;
  started_at: string;
  ended_at: string | null;
  days_on_slot: number;
};

export type WorkSlotActivityReport = {
  date_from: string;
  date_to: string;
  rows: WorkSlotActivityRow[];
  total: number;
};

function daysBetween(start: Date, end: Date): number {
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.round((ms / 86_400_000) * 10) / 10;
}

/**
 * Reja G — KPI: kim qachon qaysi slotda ishlagan (`slot_user_links` sanalari).
 */
export async function getWorkSlotActivityReport(
  tenantId: number,
  input: {
    date_from: Date;
    date_to: Date;
    branch_code?: string | null;
    slot_type?: string | null;
    page?: number;
    limit?: number;
  }
): Promise<WorkSlotActivityReport> {
  const from = input.date_from;
  const to = input.date_to;
  if (from > to) throw new Error("BAD_DATE_RANGE");

  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const skip = (page - 1) * limit;

  const slotWhere = {
    tenant_id: tenantId,
    ...(input.branch_code?.trim()
      ? { branch_code: input.branch_code.trim() }
      : {}),
    ...(input.slot_type?.trim() ? { slot_type: input.slot_type.trim() } : {})
  };

  const where = {
    tenant_id: tenantId,
    started_at: { lte: to },
    OR: [{ ended_at: null }, { ended_at: { gte: from } }],
    slot: slotWhere
  };

  const [total, links] = await Promise.all([
    prisma.slotUserLink.count({ where }),
    prisma.slotUserLink.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ started_at: "desc" }],
      select: {
        id: true,
        started_at: true,
        ended_at: true,
        user_id: true,
        user: { select: { name: true } },
        slot: {
          select: {
            id: true,
            slot_code: true,
            slot_type: true,
            branch_code: true
          }
        }
      }
    })
  ]);

  const rows: WorkSlotActivityRow[] = links.map((l) => {
    const segStart = l.started_at > from ? l.started_at : from;
    const segEnd = l.ended_at == null || l.ended_at > to ? to : l.ended_at;
    return {
      link_id: l.id,
      slot_id: l.slot.id,
      slot_code: l.slot.slot_code,
      slot_type: l.slot.slot_type,
      branch_code: l.slot.branch_code,
      user_id: l.user_id,
      user_name: l.user.name,
      started_at: l.started_at.toISOString(),
      ended_at: l.ended_at?.toISOString() ?? null,
      days_on_slot: daysBetween(segStart, segEnd)
    };
  });

  return {
    date_from: from.toISOString(),
    date_to: to.toISOString(),
    rows,
    total
  };
}
