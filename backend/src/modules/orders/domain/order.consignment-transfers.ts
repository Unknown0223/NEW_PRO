import { Prisma } from "@prisma/client";
import { prisma } from "../../../config/database";

export type ConsignmentTransferRow = {
  id: number;
  number: string;
  status: string;
  total_sum: string;
  is_consignment: boolean;
  consignment_due_date: string | null;
  consignment_moved_at: string | null;
  comment: string | null;
  client_id: number;
  client_name: string;
  agent_id: number | null;
  agent_name: string | null;
  expeditor_id: number | null;
  expeditor_name: string | null;
  moved_by_user_id: number | null;
  moved_by_name: string | null;
  payment_method_ref: string | null;
  conditions_note: string | null;
};

function startOfDayUtcFromYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!m) {
    const d = new Date(ymd);
    if (Number.isNaN(d.getTime())) throw new Error("BAD_DATE_FROM");
    return d;
  }
  // Asia/Tashkent UTC+5 — kun boshi
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), -5, 0, 0, 0));
}

function endOfDayUtcFromYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd.trim());
  if (!m) {
    const d = new Date(ymd);
    if (Number.isNaN(d.getTime())) throw new Error("BAD_DATE_TO");
    return d;
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 18, 59, 59, 999));
}

function personName(u: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  login?: string | null;
} | null | undefined): string | null {
  if (!u) return null;
  const composed = [u.last_name, u.first_name].filter(Boolean).join(" ").trim();
  return (composed || u.name || u.login || "").trim() || null;
}

function extractConditionsFromComment(comment: string | null): string | null {
  if (!comment) return null;
  const lines = comment.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;
    if (!line.includes("[Консигнация]")) continue;
    const m = /Условия:\s*(.+)$/i.exec(line);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export async function listConsignmentTransfers(
  tenantId: number,
  input: {
    date_from: string;
    date_to: string;
    search?: string;
    page: number;
    page_size: number;
  }
): Promise<{ rows: ConsignmentTransferRow[]; total: number; page: number; page_size: number }> {
  const from = startOfDayUtcFromYmd(input.date_from);
  const to = endOfDayUtcFromYmd(input.date_to);
  if (from > to) throw new Error("BAD_DATE_RANGE");

  const search = input.search?.trim() || "";
  const where: Prisma.OrderWhereInput = {
    tenant_id: tenantId,
    is_consignment: true,
    consignment_moved_at: { gte: from, lte: to },
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
            { comment: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [total, rows] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ consignment_moved_at: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * input.page_size,
      take: input.page_size,
      select: {
        id: true,
        number: true,
        status: true,
        total_sum: true,
        is_consignment: true,
        consignment_due_date: true,
        consignment_moved_at: true,
        comment: true,
        payment_method_ref: true,
        client_id: true,
        client: { select: { name: true } },
        agent_id: true,
        agent: { select: { name: true, first_name: true, last_name: true, login: true } },
        expeditor_user_id: true,
        expeditor_user: { select: { name: true, first_name: true, last_name: true, login: true } },
        consignment_moved_by_user_id: true,
        consignment_moved_by_user: {
          select: { name: true, first_name: true, last_name: true, login: true }
        }
      }
    })
  ]);

  return {
    total,
    page: input.page,
    page_size: input.page_size,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      total_sum: r.total_sum.toString(),
      is_consignment: r.is_consignment,
      consignment_due_date: r.consignment_due_date?.toISOString() ?? null,
      consignment_moved_at: r.consignment_moved_at?.toISOString() ?? null,
      comment: r.comment,
      client_id: r.client_id,
      client_name: r.client.name,
      agent_id: r.agent_id,
      agent_name: personName(r.agent),
      expeditor_id: r.expeditor_user_id,
      expeditor_name: personName(r.expeditor_user),
      moved_by_user_id: r.consignment_moved_by_user_id,
      moved_by_name: personName(r.consignment_moved_by_user),
      payment_method_ref: r.payment_method_ref,
      conditions_note: extractConditionsFromComment(r.comment)
    }))
  };
}

/** Excel: barcha sahifalar (max 5000). */
export async function listConsignmentTransfersForExport(
  tenantId: number,
  input: { date_from: string; date_to: string; search?: string }
): Promise<ConsignmentTransferRow[]> {
  const out: ConsignmentTransferRow[] = [];
  let page = 1;
  const page_size = 200;
  for (;;) {
    const chunk = await listConsignmentTransfers(tenantId, {
      ...input,
      page,
      page_size
    });
    out.push(...chunk.rows);
    if (out.length >= chunk.total || chunk.rows.length === 0 || out.length >= 5000) break;
    page += 1;
  }
  return out;
}
