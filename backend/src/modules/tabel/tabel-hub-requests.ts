/**
 * Punch review va ta'til/kasallik/overtime arizalari.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { recomputeUserWorkDay } from "./tabel-punch.service";

export async function reviewTabelPunch(
  tenantId: number,
  punchId: number,
  decision: "approved" | "rejected",
  actorUserId: number | null,
  comment?: string
) {
  const existing = await prisma.attendancePunch.findFirst({ where: { id: punchId, tenant_id: tenantId } });
  if (!existing) throw new Error("NOT_FOUND");

  const updated = await prisma.attendancePunch.update({
    where: { id: punchId },
    data: {
      is_valid: decision === "approved",
      review_status: decision,
      reviewed_by: actorUserId,
      reviewed_at: new Date(),
      comment: comment?.trim() || existing.comment
    }
  });

  const workYmd = existing.work_date.toISOString().slice(0, 10);
  const dayRecord = await recomputeUserWorkDay(tenantId, existing.user_id, workYmd);
  return { punch: updated, day_record: dayRecord };
}

export async function listTabelAbsenceRequests(
  tenantId: number,
  filters: { status?: string; type?: string; user_id?: number; only_overtime?: boolean }
) {
  const where: Prisma.StaffAbsenceRequestWhereInput = { tenant_id: tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.user_id) where.user_id = filters.user_id;
  if (filters.type) where.type = filters.type;
  else if (filters.only_overtime === true) where.type = { in: ["overtime", "weekend_work"] };
  else if (filters.only_overtime === false) where.type = { notIn: ["overtime", "weekend_work"] };

  const rows = await prisma.staffAbsenceRequest.findMany({ where, orderBy: [{ created_at: "desc" }], take: 200 });
  const uids = [...new Set(rows.map((r) => r.user_id))];
  const users = uids.length
    ? await prisma.user.findMany({
        where: { tenant_id: tenantId, id: { in: uids } },
        select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true, branch: true }
      })
    : [];
  const uMap = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = uMap.get(r.user_id);
    return {
      ...r,
      from_ymd: r.from_date.toISOString().slice(0, 10),
      to_ymd: r.to_date.toISOString().slice(0, 10),
      user_fio: u ? toFio(u) : `User #${r.user_id}`,
      user_role: u?.role ?? "—",
      user_branch: u?.branch ?? null
    };
  });
}

export async function createTabelAbsenceRequest(
  tenantId: number,
  userId: number,
  input: { type: string; from_date: string; to_date: string; hours?: number | null; reason?: string | null; attachment_key?: string | null }
) {
  const fromDate = new Date(`${input.from_date}T00:00:00.000Z`);
  const toDate = new Date(`${input.to_date}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate < fromDate) {
    throw new Error("BAD_DATE_RANGE");
  }
  const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  if (spanDays > 62) throw new Error("RANGE_TOO_LONG");
  return prisma.staffAbsenceRequest.create({
    data: {
      tenant_id: tenantId,
      user_id: userId,
      type: input.type.trim().toLowerCase(),
      from_date: fromDate,
      to_date: toDate,
      hours: input.hours != null ? Number(input.hours) : null,
      reason: input.reason?.trim() || null,
      attachment_key: input.attachment_key?.trim() || null,
      status: "pending"
    }
  });
}

export async function decideTabelAbsenceRequest(
  tenantId: number,
  id: number,
  decision: "approved" | "rejected",
  actorUserId: number | null,
  decisionComment?: string | null
) {
  const req = await prisma.staffAbsenceRequest.findFirst({ where: { id, tenant_id: tenantId } });
  if (!req) throw new Error("NOT_FOUND");
  if (req.status !== "pending") throw new Error("ALREADY_DECIDED");

  const updated = await prisma.staffAbsenceRequest.update({
    where: { id },
    data: {
      status: decision,
      approved_by: actorUserId,
      approved_at: new Date(),
      decision_comment: decisionComment?.trim() || null
    }
  });

  const cur = new Date(req.from_date.getTime());
  const end = req.to_date.getTime();
  while (cur.getTime() <= end) {
    await recomputeUserWorkDay(tenantId, req.user_id, cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return updated;
}

export async function deleteTabelAbsenceRequest(tenantId: number, id: number) {
  await prisma.staffAbsenceRequest.deleteMany({ where: { id, tenant_id: tenantId } });
  return { ok: true };
}
