/**
 * Kunlik tabel daftari: attendance_day_records — yagona manba.
 * JSON `timesheet.overrides` faqat bir marta shu jadvalga ko‘chiriladi.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export function isManualDayLock(rec: { override_by?: number | null; source?: string | null } | null | undefined): boolean {
  if (!rec) return false;
  return rec.override_by != null || rec.source === "manual";
}

export function parseTimesheetOverrideKey(key: string): { userId: number; ymd: string } | null {
  const m = /^(\d+):(\d{4}-\d{2}-\d{2})$/.exec(key);
  if (!m) return null;
  const userId = Number(m[1]);
  if (!Number.isInteger(userId) || userId <= 0) return null;
  return { userId, ymd: m[2]! };
}

export function resolveAttendanceCell<S extends string, Src extends string>(
  rec: { status: S; source: Src } | null | undefined,
  def: { status: S; source: Src }
): { status: S; source: Src } {
  return rec ? { status: rec.status, source: rec.source } : def;
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function migrateTimesheetJsonOverridesToDayRecords(tenantId: number): Promise<number> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  if (!tenant) return 0;
  const root = asObj(tenant.settings);
  const ts = asObj(root.timesheet);
  const rawOverrides = asObj(ts.overrides);
  const keys = Object.keys(rawOverrides);
  if (keys.length === 0) return 0;

  let copied = 0;
  for (const key of keys) {
    const parsed = parseTimesheetOverrideKey(key);
    if (!parsed) continue;
    const o = asObj(rawOverrides[key]);
    const status = typeof o.status === "string" ? o.status.trim() : "";
    if (!status) continue;
    const rawSource = typeof o.source === "string" ? o.source.trim() : "manual";
    const source = rawSource === "request" ? "request" : "manual";
    const overrideBy = typeof o.updated_by === "number" && o.updated_by > 0 ? o.updated_by : null;
    const workDate = new Date(`${parsed.ymd}T00:00:00.000Z`);
    await prisma.attendanceDayRecord.upsert({
      where: {
        tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: parsed.userId, work_date: workDate }
      },
      create: {
        tenant_id: tenantId,
        user_id: parsed.userId,
        work_date: workDate,
        status,
        source,
        override_by: overrideBy,
        override_comment: "Migrated from timesheet JSON override"
      },
      update: {
        status,
        source,
        override_by: overrideBy,
        override_comment: "Migrated from timesheet JSON override"
      }
    });
    copied += 1;
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...root,
        timesheet: { ...ts, overrides: {}, overrides_migrated_at: new Date().toISOString() }
      } as Prisma.InputJsonValue
    }
  });
  return copied;
}

export async function upsertManualDayRecord(input: {
  tenantId: number;
  userId: number;
  ymd: string;
  status: string;
  actorUserId: number | null;
  comment?: string | null;
}): Promise<void> {
  const workDate = new Date(`${input.ymd}T00:00:00.000Z`);
  await prisma.attendanceDayRecord.upsert({
    where: {
      tenant_id_user_id_work_date: {
        tenant_id: input.tenantId,
        user_id: input.userId,
        work_date: workDate
      }
    },
    create: {
      tenant_id: input.tenantId,
      user_id: input.userId,
      work_date: workDate,
      status: input.status,
      source: "manual",
      override_by: input.actorUserId,
      override_comment: input.comment?.trim() || null
    },
    update: {
      status: input.status,
      source: "manual",
      override_by: input.actorUserId,
      override_comment: input.comment?.trim() || null
    }
  });
}
