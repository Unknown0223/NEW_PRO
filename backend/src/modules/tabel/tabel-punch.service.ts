/**
 * Mobil Foto/Video davomat, 3 xonali kunlik kod, Brigada Kiosk va Terminal Punch servisi.
 */
import { prisma } from "../../config/database";
import { getFaceReferenceMeta } from "../mobile/mobile-face.reference";
import { resolvePunchModesForRole } from "./tabel-settings.pure";
import { resolveUserShift } from "./tabel-shift-resolve.service";
import {
  issueOrGetDayCode,
  loadTenantTabelContext,
  todayYmdInTz
} from "./tabel-punch-core.service";

export { resolveUserShift };
export {
  issueOrGetDayCode,
  loadTenantTabelContext,
  recomputeUserWorkDay,
  todayYmdInTz
} from "./tabel-punch-core.service";
export { submitAttendancePunch, type SubmitPunchInput } from "./tabel-punch-submit.service";

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
  const modes = resolvePunchModesForRole(ctx.tabelSettings.punchModes, user?.role, {
    userId,
    kioskLeaderIds: ctx.tabelSettings.faceAntifraud.kioskLeaderIds,
    punchVideoEnabled: pv.enabled,
    videoUserOverrideEnabled: userOverride
      ? userOverride.enabled
      : pv.allowAllStaffByDefault
        ? null
        : false
  });
  const videoEnabled = modes.video;
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
    kiosk_allowed: modes.kiosk,
    photo_punch: { enabled: modes.photo },
    punch_modes: {
      photo: modes.photo,
      video: modes.video,
      kiosk: modes.kiosk,
      terminal: modes.terminal,
      mobile_any: modes.mobileAny
    },
    allowed_methods: modes.allowedMethods,
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
