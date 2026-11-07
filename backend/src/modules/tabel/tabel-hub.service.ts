/**
 * «Табель и посещаемость» yon paneli (Журнал отметок, Проблемные отметки,
 * Смены, Локации, Заявки на отпуск/больничный/сверхурочные) va `/settings/tabel` servisi.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { toFio } from "../staff/staff.shared.helpers";
import { loadBranchLabelSources } from "../tenant-settings/tenant-settings.refs";
import {
  branchLabelLookup,
  branchVisibleName,
  expandBranchFilterKeys
} from "../tenant-settings/branch-display.pure";
import { punchProblemLabels } from "./tabel-problem-reasons.pure";
import { mergeTabelAudit, readTabelAudit } from "./tabel-audit";
import {
  maskTabelSettingsForClient,
  normalizeFullTabelSettings,
  type FullTabelSettings
} from "./tabel-settings.pure";

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function getTabelSettingsForUi(tenantId: number): Promise<FullTabelSettings> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const root = asObj(tenant?.settings);
  return maskTabelSettingsForClient(normalizeFullTabelSettings(root.tabel_settings));
}

export async function patchTabelSettings(
  tenantId: number,
  patch: Record<string, unknown>,
  actorLabel: string
): Promise<FullTabelSettings> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const root = asObj(tenant?.settings);
  const current = normalizeFullTabelSettings(root.tabel_settings);

  const nextRaw: Record<string, unknown> = {
    lateness: { ...current.lateness, ...asObj(patch.lateness) },
    punchVideo: {
      ...current.punchVideo,
      ...asObj(patch.punchVideo),
      userOverrides: { ...current.punchVideo.userOverrides, ...asObj(asObj(patch.punchVideo).userOverrides) }
    },
    faceAntifraud: { ...current.faceAntifraud, ...asObj(patch.faceAntifraud) },
    telegram: {
      ...current.telegram,
      ...asObj(patch.telegram),
      branchChatIds:
        asObj(patch.telegram).branchChatIds !== undefined
          ? asObj(asObj(patch.telegram).branchChatIds)
          : current.telegram.branchChatIds
    },
    retention: {
      ...current.retention,
      ...asObj(patch.retention),
      compress: { ...current.retention.compress, ...asObj(asObj(patch.retention).compress) }
    },
    dictionaries: {
      absenceTypes:
        asObj(patch.dictionaries).absenceTypes !== undefined
          ? (asObj(patch.dictionaries).absenceTypes as typeof current.dictionaries.absenceTypes)
          : current.dictionaries.absenceTypes,
      clearanceItems:
        asObj(patch.dictionaries).clearanceItems !== undefined
          ? (asObj(patch.dictionaries).clearanceItems as typeof current.dictionaries.clearanceItems)
          : current.dictionaries.clearanceItems
    },
    punchModes: {
      methods: {
        ...current.punchModes.methods,
        ...asObj(asObj(patch.punchModes).methods)
      },
      byRole:
        asObj(patch.punchModes).byRole !== undefined
          ? asObj(asObj(patch.punchModes).byRole)
          : current.punchModes.byRole
    }
  };

  const tgPatch = asObj(patch.telegram);
  if (tgPatch.botToken === "" || tgPatch.botToken === undefined) {
    (nextRaw.telegram as Record<string, unknown>).botToken = current.telegram.botToken;
  } else if (tgPatch.botToken === null) {
    (nextRaw.telegram as Record<string, unknown>).botToken = "";
  }

  const normalized = normalizeFullTabelSettings(nextRaw);
  const nextSettings: Record<string, unknown> = {
    ...root,
    tabel_settings: normalized,
    tabel_audit: mergeTabelAudit(readTabelAudit(tenant?.settings ?? {}), [
      {
        module: "timesheet",
        kind: "settings",
        title: "Настройки табеля и посещаемости",
        subtitle: Object.keys(patch).join(", ") || "обновление",
        oldValue: "предыдущие параметры",
        newValue: "обновлено",
        comment: "Изменены правила посещаемости / Face ID / Retention",
        changedBy: actorLabel
      }
    ])
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings as Prisma.InputJsonValue }
  });

  return maskTabelSettingsForClient(normalized);
}

export async function listTabelMarks(
  tenantId: number,
  filters: {
    from?: string;
    to?: string;
    user_id?: number;
    branch?: string;
    source?: string;
    only_problems?: boolean;
    /** Ro‘yxat 300, Excel eksporti 5000 gacha. */
    take?: number;
  }
) {
  const where: Prisma.AttendancePunchWhereInput = { tenant_id: tenantId };
  if (filters.from || filters.to) {
    where.work_date = {};
    if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
      where.work_date.gte = new Date(`${filters.from}T00:00:00.000Z`);
    }
    if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
      where.work_date.lte = new Date(`${filters.to}T00:00:00.000Z`);
    }
  }
  const branchNames = (filters.branch ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const branchCatalog = await loadBranchLabelSources(tenantId);
  const branchLookup = branchLabelLookup(branchCatalog);
  const branchKeys = expandBranchFilterKeys(branchNames, branchCatalog);
  if (filters.user_id) where.user_id = filters.user_id;
  if (branchKeys.length > 0) {
    const inBranches = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        OR: branchKeys.flatMap((name) => [
          { branch: { equals: name, mode: "insensitive" as const } },
          { branch_links: { some: { branch_code: { equals: name, mode: "insensitive" as const } } } }
        ])
      },
      select: { id: true }
    });
    const ids = inBranches.map((u) => u.id);
    const allowed = filters.user_id ? ids.filter((id) => id === filters.user_id) : ids;
    where.user_id = { in: allowed.length ? allowed : [-1] };
  }
  if (filters.source) where.source = filters.source;
  if (filters.only_problems) {
    where.OR = [
      { is_valid: false },
      { outside_geofence: true },
      { review_status: "pending" },
      { face_score: { lt: 0.85 } }
    ];
  }

  const take = Math.min(Math.max(filters.take ?? 300, 1), 5000);
  const punches = await prisma.attendancePunch.findMany({
    where,
    orderBy: [{ occurred_at: "desc" }],
    take
  });

  const userIds = [...new Set(punches.map((p) => p.user_id))];
  const locIds = [...new Set(punches.map((p) => p.location_id).filter((x): x is number => x != null))];

  const [users, locations] = await Promise.all([
    userIds.length
      ? prisma.user.findMany({
          where: { tenant_id: tenantId, id: { in: userIds } },
          select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true, branch: true, login: true, code: true }
        })
      : Promise.resolve([]),
    locIds.length
      ? prisma.attendanceLocation.findMany({
          where: { tenant_id: tenantId, id: { in: locIds } },
          select: { id: true, name: true, branch: true }
        })
      : Promise.resolve([])
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const locMap = new Map(locations.map((l) => [l.id, l]));

  return punches
    .map((p) => {
      const u = userMap.get(p.user_id);
      const loc = p.location_id ? locMap.get(p.location_id) : null;
      return {
        ...p,
        work_date_ymd: p.work_date.toISOString().slice(0, 10),
        user_fio: u ? toFio(u) : `User #${p.user_id}`,
        user_role: u?.role ?? "—",
        user_branch: branchVisibleName(u?.branch ?? null, branchLookup),
        user_login: u?.login ?? "—",
        user_code: u?.code ?? null,
        location_name: loc?.name ?? null,
        has_photo_front: Boolean(p.photo_front_key),
        has_photo_back: Boolean(p.photo_back_key),
        has_video_front: Boolean(p.video_front_key),
        has_video_back: Boolean(p.video_back_key),
        problem_reasons: punchProblemLabels(p)
      };
    });
}

const MEDIA_SLOTS = ["photo_front", "photo_back", "video_front", "video_back"] as const;
export type TabelMediaSlot = (typeof MEDIA_SLOTS)[number];

export function isTabelMediaSlot(slot: string): slot is TabelMediaSlot {
  return (MEDIA_SLOTS as readonly string[]).includes(slot);
}

/** Bitta otmetkaning rasm yoki video kaliti. Ro‘yxatni yuklamaydi. */
export async function getTabelPunchMediaKey(
  tenantId: number,
  punchId: number,
  slot: TabelMediaSlot
): Promise<string | null> {
  const row = await prisma.attendancePunch.findFirst({
    where: { id: punchId, tenant_id: tenantId },
    select: {
      photo_front_key: true,
      photo_back_key: true,
      video_front_key: true,
      video_back_key: true
    }
  });
  if (!row) return null;
  if (slot === "photo_back") return row.photo_back_key;
  if (slot === "video_front") return row.video_front_key;
  if (slot === "video_back") return row.video_back_key;
  return row.photo_front_key;
}

export async function listTabelShifts(tenantId: number) {
  const rows = await prisma.attendanceShift.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ is_default: "desc" }, { id: "asc" }]
  });
  if (rows.length > 0) return rows;
  const def = await prisma.attendanceShift.create({
    data: {
      tenant_id: tenantId,
      name: "Дневная смена (09:00–18:00)",
      start_time: "09:00",
      end_time: "18:00",
      break_minutes: 60,
      grace_minutes: 15,
      is_default: true,
      is_active: true
    }
  });
  return [def];
}

export async function saveTabelShift(
  tenantId: number,
  input: {
    id?: number;
    name: string;
    start_time: string;
    end_time: string;
    break_minutes?: number;
    grace_minutes?: number;
    role?: string | null;
    branch?: string | null;
    is_default?: boolean;
    is_active?: boolean;
    comment?: string | null;
  }
) {
  if (input.is_default) {
    await prisma.attendanceShift.updateMany({ where: { tenant_id: tenantId }, data: { is_default: false } });
  }
  const data = {
    name: input.name.trim(),
    start_time: input.start_time.trim(),
    end_time: input.end_time.trim(),
    break_minutes: input.break_minutes ?? 60,
    grace_minutes: input.grace_minutes ?? 15,
    role: input.role?.trim() || null,
    branch: input.branch?.trim() || null,
    is_default: Boolean(input.is_default),
    is_active: input.is_active !== false,
    comment: input.comment?.trim() || null
  };
  if (input.id) {
    return prisma.attendanceShift.update({ where: { id: input.id }, data });
  }
  return prisma.attendanceShift.create({ data: { tenant_id: tenantId, ...data } });
}

export async function deleteTabelShift(tenantId: number, id: number) {
  await prisma.attendanceShift.deleteMany({ where: { id, tenant_id: tenantId } });
  return { ok: true };
}

export async function listTabelLocations(tenantId: number) {
  return prisma.attendanceLocation.findMany({
    where: { tenant_id: tenantId },
    orderBy: [{ is_active: "desc" }, { id: "asc" }]
  });
}

export async function saveTabelLocation(
  tenantId: number,
  input: {
    id?: number;
    name: string;
    address?: string | null;
    branch?: string | null;
    lat: number;
    lng: number;
    radius_m?: number;
    require_comment_outside?: boolean;
    is_active?: boolean;
  }
) {
  const data = {
    name: input.name.trim(),
    address: input.address?.trim() || null,
    branch: input.branch?.trim() || null,
    lat: Number(input.lat),
    lng: Number(input.lng),
    radius_m: Math.max(20, Math.min(5000, Math.round(Number(input.radius_m ?? 150)))),
    require_comment_outside: input.require_comment_outside !== false,
    is_active: input.is_active !== false
  };
  if (input.id) return prisma.attendanceLocation.update({ where: { id: input.id }, data });
  return prisma.attendanceLocation.create({ data: { tenant_id: tenantId, ...data } });
}

export async function deleteTabelLocation(tenantId: number, id: number) {
  await prisma.attendanceLocation.deleteMany({ where: { id, tenant_id: tenantId } });
  return { ok: true };
}
