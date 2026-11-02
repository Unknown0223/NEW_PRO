/**
 * Mobil Foto/Video davomat, 3 xonali kunlik kod, Brigada Kiosk va Terminal Punch servisi.
 */
import { prisma } from "../../config/database";
import { isCalendarWorkingDay } from "../../lib/workday-calendar";
import { buildFaceDescriptor } from "../mobile/face-match.descriptor";
import { faceMatchScore } from "../mobile/face-match.pure";
import { readUiPrefs } from "../mobile/mobile-face.shared";
import { getFaceReferenceMeta, loadOrBuildReferenceDescriptor } from "../mobile/mobile-face.reference";
import { loadTimezoneFromSettingsJson } from "../tenant-settings/tenant-timezone";
import { toFio } from "../staff/staff.shared.helpers";
import { parseWorkdaysState } from "./workdays.service";
import { computeDayFromPunches } from "./tabel-engine.pure";
import { assertVideoPunch, normalizeFullTabelSettings, pickDayCode, type FullTabelSettings } from "./tabel-settings.pure";
import { evaluateGeofenceAgainstLocations, evaluateTenLayerAntiFraud } from "./tabel-antifraud.pure";
import { decodeBase64Media, saveCompressedPunchPhoto, savePunchVideo, sendAttendanceTelegramReport } from "./tabel-media-telegram.service";
import { isManualDayLock } from "../timesheet/timesheet.day-ledger";
import { markPayrollDirty } from "../payroll/payroll.dirty";
import { resolveUserShift } from "./tabel-shift-resolve.service";

export { resolveUserShift };

function todayYmdInTz(now: Date, timeZone = "Asia/Tashkent"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export async function loadTenantTabelContext(tenantId: number): Promise<{
  timeZone: string;
  workdays: ReturnType<typeof parseWorkdaysState>;
  tabelSettings: FullTabelSettings;
  rawSettings: Record<string, unknown>;
}> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const raw =
    tenant?.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? (tenant.settings as Record<string, unknown>)
      : {};
  return {
    timeZone: loadTimezoneFromSettingsJson(tenant?.settings ?? {}),
    workdays: parseWorkdaysState(tenant?.settings ?? {}),
    tabelSettings: normalizeFullTabelSettings(raw.tabel_settings),
    rawSettings: raw
  };
}

export async function issueOrGetDayCode(tenantId: number, userId: number, workYmd?: string): Promise<number> {
  const ymd = workYmd ?? todayYmdInTz(new Date());
  const workDate = new Date(`${ymd}T00:00:00.000Z`);
  const existing = await prisma.punchDayCode.findUnique({
    where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } }
  });
  if (existing) return existing.code;

  const takenRows = await prisma.punchDayCode.findMany({ where: { tenant_id: tenantId, work_date: workDate }, select: { code: true } });
  const code = pickDayCode(new Set(takenRows.map((r) => r.code))) ?? 100 + (userId % 900);
  try {
    const created = await prisma.punchDayCode.create({ data: { tenant_id: tenantId, user_id: userId, work_date: workDate, code } });
    return created.code;
  } catch {
    const again = await prisma.punchDayCode.findUnique({
      where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } }
    });
    return again?.code ?? code;
  }
}

export async function recomputeUserWorkDay(tenantId: number, userId: number, workYmd: string, now = new Date()) {
  const ctx = await loadTenantTabelContext(tenantId);
  const user = await prisma.user.findFirst({ where: { id: userId, tenant_id: tenantId }, select: { id: true, role: true, branch: true } });
  if (!user) return null;

  const workDate = new Date(`${workYmd}T00:00:00.000Z`);
  const existing = await prisma.attendanceDayRecord.findUnique({
    where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } }
  });
  if (isManualDayLock(existing)) return existing;

  const [shift, punches, req] = await Promise.all([
    resolveUserShift(tenantId, user.role, user.branch),
    prisma.attendancePunch.findMany({ where: { tenant_id: tenantId, user_id: userId, work_date: workDate }, orderBy: { occurred_at: "asc" } }),
    prisma.staffAbsenceRequest.findFirst({
      where: { tenant_id: tenantId, user_id: userId, status: "approved", from_date: { lte: workDate }, to_date: { gte: workDate } },
      orderBy: { id: "desc" }
    })
  ]);

  const isWorkingDay = isCalendarWorkingDay(ctx.workdays, user.role, user.id, workYmd);
  const computed = computeDayFromPunches({
    workYmd,
    now,
    timeZone: ctx.timeZone,
    isWorkingDay,
    shift,
    earlyLeaveGraceMinutes: ctx.tabelSettings.lateness.earlyLeaveGraceMinutes,
    punches: punches.map((p) => ({ id: p.id, occurred_at: p.occurred_at, source: p.source, is_valid: p.is_valid })),
    approvedRequest: req ? { type: req.type, hours: req.hours } : null
  });

  for (const pr of computed.punch_roles) {
    if (!pr.id) continue;
    await prisma.attendancePunch.update({
      where: { id: pr.id },
      data: { role_in_day: pr.role_in_day, direction: pr.role_in_day === "in" ? "IN" : "OUT" }
    });
  }

  const dayData = {
    status: computed.status,
    source: computed.source,
    first_in_at: computed.first_in_at,
    last_out_at: computed.last_out_at,
    late_minutes: computed.late_minutes,
    early_leave_minutes: computed.early_leave_minutes,
    worked_minutes: computed.worked_minutes,
    overtime_minutes: computed.overtime_minutes
  };

  const row = await prisma.attendanceDayRecord.upsert({
    where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } },
    create: { tenant_id: tenantId, user_id: userId, work_date: workDate, ...dayData },
    update: dayData
  });
  const year = Number(workYmd.slice(0, 4));
  const month = Number(workYmd.slice(5, 7));
  if (Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12) {
    void markPayrollDirty(tenantId, { userIds: [userId], year, month }, "tabel_punch");
  }
  return row;
}

export async function getMobileAttendanceState(tenantId: number, userId: number) {
  const ctx = await loadTenantTabelContext(tenantId);
  const now = new Date();
  const todayYmd = todayYmdInTz(now, ctx.timeZone);
  const workDate = new Date(`${todayYmd}T00:00:00.000Z`);

  const [user, locations, punches, dayRecord, faceMeta] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { id: true, role: true, branch: true, name: true, first_name: true, last_name: true, middle_name: true }
    }),
    prisma.attendanceLocation.findMany({ where: { tenant_id: tenantId, is_active: true }, orderBy: { id: "asc" } }),
    prisma.attendancePunch.findMany({ where: { tenant_id: tenantId, user_id: userId, work_date: workDate }, orderBy: { occurred_at: "asc" } }),
    prisma.attendanceDayRecord.findUnique({ where: { tenant_id_user_id_work_date: { tenant_id: tenantId, user_id: userId, work_date: workDate } } }),
    getFaceReferenceMeta(tenantId, userId)
  ]);

  const shift = await resolveUserShift(tenantId, user?.role, user?.branch);
  const pv = ctx.tabelSettings.punchVideo;
  const userOverride = pv.userOverrides[String(userId)];
  const videoEnabled = pv.enabled && (userOverride ? userOverride.enabled : pv.allowAllStaffByDefault);
  const codeRequired = videoEnabled && (userOverride ? userOverride.codeRequired : pv.codeRequired);
  const dayCode = codeRequired ? await issueOrGetDayCode(tenantId, userId, todayYmd) : null;

  return {
    server_time: now.toISOString(),
    today_ymd: todayYmd,
    shift,
    face_enrolled: faceMeta.has_reference,
    liveness_directions: ctx.tabelSettings.faceAntifraud.livenessDirections,
    require_dual_camera: ctx.tabelSettings.faceAntifraud.requireDualCameraPhoto,
    max_gps_accuracy_m: ctx.tabelSettings.faceAntifraud.maxGpsAccuracyM,
    kiosk_allowed: user?.role === "admin" || user?.role === "supervisor" || ctx.tabelSettings.faceAntifraud.kioskLeaderIds.includes(userId),
    video_punch: {
      enabled: videoEnabled,
      code_required: codeRequired,
      day_code: dayCode,
      min_sec: pv.minSec,
      max_sec: pv.maxSec,
      capture_mode: pv.captureMode
    },
    locations,
    today_record: dayRecord,
    today_punches: punches
  };
}

export type SubmitPunchInput = {
  source: "mobile_photo" | "mobile_video" | "kiosk" | "terminal";
  direction?: "IN" | "OUT";
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  is_mock_location?: boolean;
  client_timestamp?: string | null;
  from_gallery?: boolean;
  face_count?: number | null;
  liveness_steps?: unknown;
  photo_front_base64?: string | null;
  photo_back_base64?: string | null;
  video_front_base64?: string | null;
  video_back_base64?: string | null;
  capture_mode?: "simultaneous" | "sequential";
  duration_sec?: number | null;
  spoken_code?: number | null;
  comment?: string | null;
  kiosk_leader_id?: number | null;
  device_id?: number | null;
  face_score_override?: number | null;
};

export async function submitAttendancePunch(tenantId: number, userId: number, input: SubmitPunchInput) {
  const ctx = await loadTenantTabelContext(tenantId);
  const now = new Date();
  const todayYmd = todayYmdInTz(now, ctx.timeZone);
  const workDate = new Date(`${todayYmd}T00:00:00.000Z`);

  const [user, locations, existingValidPunches] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, tenant_id: tenantId },
      select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, role: true, branch: true, ui_preferences: true }
    }),
    prisma.attendanceLocation.findMany({ where: { tenant_id: tenantId, is_active: true } }),
    prisma.attendancePunch.count({ where: { tenant_id: tenantId, user_id: userId, work_date: workDate, is_valid: true } })
  ]);
  if (!user) throw new Error("USER_NOT_FOUND");

  const geo = evaluateGeofenceAgainstLocations(input.lat, input.lng, locations, user.branch);

  let computedFaceScore: number | null = input.source === "terminal" ? (input.face_score_override ?? null) : null;
  let frontPhotoBuf: Buffer | null = null;
  if (input.photo_front_base64) {
    frontPhotoBuf = decodeBase64Media(input.photo_front_base64);
    if (computedFaceScore == null) {
      const prefs = readUiPrefs(user.ui_preferences);
      const refDesc = await loadOrBuildReferenceDescriptor(tenantId, userId, prefs).catch(() => null);
      if (refDesc) {
        try {
          computedFaceScore = faceMatchScore(refDesc, await buildFaceDescriptor(frontPhotoBuf));
        } catch {
          computedFaceScore = 0;
        }
      } else {
        computedFaceScore = 0;
      }
    }
  }

  let expectedDayCode: number | null = null;
  let frontVideoBuf: Buffer | null = null;
  let backVideoBuf: Buffer | null = null;
  if (input.source === "mobile_video") {
    const pv = ctx.tabelSettings.punchVideo;
    const uo = pv.userOverrides[String(userId)];
    const codeReq = uo ? uo.codeRequired : pv.codeRequired;
    expectedDayCode = codeReq ? await issueOrGetDayCode(tenantId, userId, todayYmd) : null;
    frontVideoBuf = input.video_front_base64 ? decodeBase64Media(input.video_front_base64) : Buffer.alloc(0);
    if (input.video_back_base64) backVideoBuf = decodeBase64Media(input.video_back_base64);
    const vCheck = assertVideoPunch({
      durationSec: Number(input.duration_sec ?? 8),
      bytes: Math.max(frontVideoBuf.length, 15_000),
      enabled: pv.enabled,
      codeRequired: codeReq,
      code: expectedDayCode,
      spokenCode: input.spoken_code,
      minSec: pv.minSec,
      maxSec: pv.maxSec
    });
    if (!vCheck.ok) {
      const err = new Error(vCheck.message) as Error & { code?: string };
      err.code = vCheck.code;
      throw err;
    }
  }

  const isTerminalOrKiosk = input.source === "terminal" || input.source === "kiosk";
  const antiFraud = evaluateTenLayerAntiFraud({
    settings: ctx.tabelSettings.faceAntifraud,
    isMockLocation: input.is_mock_location,
    accuracyM: input.accuracy_m,
    clientTimestampIso: input.client_timestamp,
    serverNow: now,
    fromGallery: input.from_gallery,
    faceCount: input.face_count,
    livenessSteps: input.liveness_steps,
    skipLiveness: isTerminalOrKiosk || input.source === "mobile_video",
    faceScore: computedFaceScore ?? (input.source === "mobile_photo" || input.source === "kiosk" ? 0 : 1),
    skipFaceMatch: (input.source === "mobile_video" && !frontPhotoBuf) || input.source === "terminal",
    hasBackPhotoOrVideo: Boolean(input.photo_back_base64 || input.video_back_base64),
    skipDualCamera: isTerminalOrKiosk || !ctx.tabelSettings.faceAntifraud.requireDualCameraPhoto,
    expectedDayCode,
    spokenDayCode: input.spoken_code,
    outsideGeofence: geo.outsideGeofence,
    requireCommentOutside: geo.commentRequired,
    comment: input.comment
  });

  const compressOpts = ctx.tabelSettings.retention.compress;
  const frontPhotoSaved = frontPhotoBuf ? await saveCompressedPunchPhoto(tenantId, userId, "front", frontPhotoBuf, compressOpts) : null;
  const backPhotoSaved = input.photo_back_base64 ? await saveCompressedPunchPhoto(tenantId, userId, "back", input.photo_back_base64, compressOpts) : null;
  const frontVideoSaved = frontVideoBuf && frontVideoBuf.length > 0 ? await savePunchVideo(tenantId, userId, "front", frontVideoBuf) : null;
  const backVideoSaved = backVideoBuf && backVideoBuf.length > 0 ? await savePunchVideo(tenantId, userId, "back", backVideoBuf) : null;

  const direction = input.direction ?? (existingValidPunches === 0 ? "IN" : "OUT");
  const isValid = antiFraud.ok;
  const reviewStatus = !isValid || geo.outsideGeofence ? "pending" : "auto";

  const punch = await prisma.attendancePunch.create({
    data: {
      tenant_id: tenantId,
      user_id: userId,
      work_date: workDate,
      occurred_at: now,
      direction,
      role_in_day: existingValidPunches === 0 ? "in" : "estimated_out",
      source: input.source,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      accuracy_m: input.accuracy_m ?? null,
      outside_geofence: geo.outsideGeofence,
      location_id: geo.matchedLocation?.id ?? null,
      device_id: input.device_id ?? null,
      kiosk_leader_id: input.kiosk_leader_id ?? null,
      photo_front_key: frontPhotoSaved?.key ?? null,
      photo_back_key: backPhotoSaved?.key ?? null,
      video_front_key: frontVideoSaved?.key ?? null,
      video_back_key: backVideoSaved?.key ?? null,
      capture_mode: input.capture_mode ?? null,
      duration_sec: input.duration_sec ?? null,
      day_code: expectedDayCode,
      face_score: computedFaceScore,
      liveness_steps: Array.isArray(input.liveness_steps) ? input.liveness_steps : [],
      integrity_json: {
        verdict: antiFraud.ok ? "ok" : antiFraud.failedCode,
        failedMessage: antiFraud.failedMessage,
        distanceMeters: geo.distanceMeters,
        locationName: geo.matchedLocation?.name ?? null,
        layers: antiFraud.layers
      },
      is_valid: isValid,
      review_status: reviewStatus,
      comment: input.comment?.trim() || null
    }
  });

  const dayRecord = await recomputeUserWorkDay(tenantId, userId, todayYmd, now);
  const tgReport = await sendAttendanceTelegramReport(ctx.tabelSettings.telegram, {
    branch: user.branch,
    employeeName: toFio(user),
    role: user.role,
    direction,
    source: input.source,
    dayCode: expectedDayCode,
    captureMode: input.capture_mode ?? null,
    locationName: geo.matchedLocation?.name ?? null,
    outsideGeofence: geo.outsideGeofence,
    comment: input.comment ?? null,
    fraudAlert: !antiFraud.ok ? `${antiFraud.failedCode}: ${antiFraud.failedMessage}` : null,
    photoFrontBuf: frontPhotoBuf,
    videoFrontBuf: frontVideoBuf,
    videoBackBuf: backVideoBuf
  });

  if (!antiFraud.ok) {
    const err = new Error(antiFraud.failedMessage ?? "Anti-fraud tekshiruvidan o'tmadi") as Error & { code?: string; punchId?: number };
    err.code = antiFraud.failedCode ?? "ANTIFRAUD_REJECTED";
    err.punchId = punch.id;
    throw err;
  }

  return {
    punch,
    day_record: dayRecord,
    geofence: { outside: geo.outsideGeofence, distance_m: geo.distanceMeters, location_name: geo.matchedLocation?.name ?? null },
    anti_fraud: antiFraud,
    telegram_sent: tgReport.sent
  };
}
