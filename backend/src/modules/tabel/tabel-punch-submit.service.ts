/**
 * Davomat belgisini yozish (foto/video/kiosk/terminal).
 */
import { prisma } from "../../config/database";
import { buildFaceDescriptor } from "../mobile/face-match.descriptor";
import { faceMatchScore } from "../mobile/face-match.pure";
import { readUiPrefs } from "../mobile/mobile-face.shared";
import { loadOrBuildReferenceDescriptor } from "../mobile/mobile-face.reference";
import { toFio } from "../staff/staff.shared.helpers";
import {
  assertPunchSourceAllowed,
  assertVideoPunch,
  resolvePunchModesForRole
} from "./tabel-settings.pure";
import { evaluateGeofenceAgainstLocations, evaluateTenLayerAntiFraud } from "./tabel-antifraud.pure";
import { decodeBase64Media, saveCompressedPunchPhoto, savePunchVideo, sendAttendanceTelegramReport } from "./tabel-media-telegram.service";
import {
  issueOrGetDayCode,
  loadTenantTabelContext,
  recomputeUserWorkDay,
  todayYmdInTz
} from "./tabel-punch-core.service";

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

  const pvGate = ctx.tabelSettings.punchVideo;
  const videoUo = pvGate.userOverrides[String(userId)];
  const modes = resolvePunchModesForRole(ctx.tabelSettings.punchModes, user.role, {
    userId,
    kioskLeaderIds: ctx.tabelSettings.faceAntifraud.kioskLeaderIds,
    punchVideoEnabled: pvGate.enabled,
    videoUserOverrideEnabled: videoUo ? videoUo.enabled : pvGate.allowAllStaffByDefault ? null : false
  });
  if (input.source === "kiosk") {
    const leaderId = Number(input.kiosk_leader_id ?? 0);
    const leader = leaderId
      ? await prisma.user.findFirst({
          where: { id: leaderId, tenant_id: tenantId },
          select: { id: true, role: true }
        })
      : null;
    const leaderModes = resolvePunchModesForRole(ctx.tabelSettings.punchModes, leader?.role, {
      userId: leader?.id,
      kioskLeaderIds: ctx.tabelSettings.faceAntifraud.kioskLeaderIds,
      applyKioskLeaderGate: true
    });
    const targetModes = resolvePunchModesForRole(ctx.tabelSettings.punchModes, user.role, {
      applyKioskLeaderGate: false
    });
    if (!leaderModes.kiosk || !targetModes.kiosk) {
      const err = new Error("Для вашей роли этот способ отметки отключён") as Error & { code?: string };
      err.code = "METHOD_NOT_ALLOWED";
      throw err;
    }
  } else {
    const gate = assertPunchSourceAllowed(modes, input.source);
    if (!gate.ok) {
      const err = new Error(gate.message) as Error & { code?: string };
      err.code = gate.code;
      throw err;
    }
  }

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
      enabled: modes.video,
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
