/**
 * 10 qatlamli Anti-Fraud, Geozona va Liveness tekshiruvlari (pure).
 */
import type { FaceAntifraudSettings } from "./tabel-settings.pure";

export const FOUR_DIRECTIONS = ["left", "right", "up", "down"] as const;
export const EIGHT_DIRECTIONS = [
  "left",
  "right",
  "up",
  "down",
  "up_left",
  "up_right",
  "down_left",
  "down_right"
] as const;

export type LivenessDirection = (typeof EIGHT_DIRECTIONS)[number];

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export type GeofenceLocationCandidate = {
  id: number;
  name: string;
  branch?: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  require_comment_outside: boolean;
};

export type GeofenceEvalResult = {
  matchedLocation: GeofenceLocationCandidate | null;
  distanceMeters: number | null;
  outsideGeofence: boolean;
  commentRequired: boolean;
};

export function evaluateGeofenceAgainstLocations(
  lat: number | null | undefined,
  lng: number | null | undefined,
  locations: GeofenceLocationCandidate[],
  userBranch?: string | null
): GeofenceEvalResult {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || locations.length === 0) {
    return {
      matchedLocation: null,
      distanceMeters: null,
      outsideGeofence: false,
      commentRequired: false
    };
  }
  const branchNorm = (userBranch ?? "").trim().toLowerCase();
  const branchMatched = branchNorm
    ? locations.filter((l) => !l.branch || l.branch.trim().toLowerCase() === branchNorm)
    : locations;
  const pool = branchMatched.length > 0 ? branchMatched : locations;

  let nearest: GeofenceLocationCandidate | null = null;
  let minDistance = Infinity;
  for (const loc of pool) {
    const d = haversineMeters(lat, lng, loc.lat, loc.lng);
    if (d < minDistance) {
      minDistance = d;
      nearest = loc;
    }
  }
  if (!nearest) {
    return { matchedLocation: null, distanceMeters: null, outsideGeofence: false, commentRequired: false };
  }
  const outside = minDistance > Math.max(20, nearest.radius_m || 150);
  return {
    matchedLocation: nearest,
    distanceMeters: minDistance,
    outsideGeofence: outside,
    commentRequired: outside && nearest.require_comment_outside
  };
}

export function validateLivenessSteps(
  steps: unknown,
  requiredCount: 4 | 8
): { ok: boolean; validDirections: string[]; reason?: string } {
  if (!Array.isArray(steps)) {
    return { ok: false, validDirections: [], reason: "LIVENESS_MISSING" };
  }
  const allowed = new Set<string>(requiredCount === 8 ? EIGHT_DIRECTIONS : FOUR_DIRECTIONS);
  const dirs: string[] = [];
  for (const item of steps) {
    const dir =
      typeof item === "string"
        ? item.trim().toLowerCase()
        : item && typeof item === "object" && typeof (item as { dir?: unknown }).dir === "string"
          ? ((item as { dir: string }).dir.trim().toLowerCase())
          : "";
    if (allowed.has(dir)) dirs.push(dir);
  }
  const unique = [...new Set(dirs)];
  const minUnique = requiredCount === 8 ? 6 : 3;
  if (dirs.length < requiredCount || unique.length < minUnique) {
    return {
      ok: false,
      validDirections: dirs,
      reason: `Bosh burish tekshiruvi to'liq emas (${unique.length}/${requiredCount})`
    };
  }
  return { ok: true, validDirections: dirs };
}

export type TenLayerAntiFraudInput = {
  settings: FaceAntifraudSettings;
  isMockLocation?: boolean;
  accuracyM?: number | null;
  clientTimestampIso?: string | null;
  serverNow?: Date;
  fromGallery?: boolean;
  faceCount?: number | null;
  livenessSteps?: unknown;
  skipLiveness?: boolean;
  faceScore?: number | null;
  useSfaceThreshold?: boolean;
  skipFaceMatch?: boolean;
  hasBackPhotoOrVideo?: boolean;
  skipDualCamera?: boolean;
  expectedDayCode?: number | null;
  spokenDayCode?: number | null;
  outsideGeofence?: boolean;
  requireCommentOutside?: boolean;
  comment?: string | null;
};

export type AntiFraudLayerResult = {
  layer: number;
  code: string;
  passed: boolean;
  detail: string;
};

export type TenLayerAntiFraudVerdict = {
  ok: boolean;
  failedCode: string | null;
  failedMessage: string | null;
  layers: AntiFraudLayerResult[];
};

export function evaluateTenLayerAntiFraud(input: TenLayerAntiFraudInput): TenLayerAntiFraudVerdict {
  const s = input.settings;
  const now = input.serverNow ?? new Date();
  const layers: AntiFraudLayerResult[] = [];

  // 1. Fake GPS / Mock Location
  const mockPass = !(s.blockMockGps && input.isMockLocation === true);
  layers.push({
    layer: 1,
    code: "FAKE_GPS_DETECTED",
    passed: mockPass,
    detail: mockPass ? "Haqiqiy GPS" : "Soxta GPS (Mock Location) aniqlandi"
  });

  // 2. GPS Accuracy
  const acc = input.accuracyM != null ? Number(input.accuracyM) : 10;
  const accPass = !Number.isFinite(acc) || acc <= s.maxGpsAccuracyM;
  layers.push({
    layer: 2,
    code: "GPS_ACCURACY_LOW",
    passed: accPass,
    detail: accPass ? `GPS aniqligi: ${Math.round(acc)}m` : `GPS aniqligi past (${Math.round(acc)}m > ${s.maxGpsAccuracyM}m)`
  });

  // 3. Server Time / Clock Skew
  let clockPass = true;
  let skewSec = 0;
  if (input.clientTimestampIso) {
    const clientMs = new Date(input.clientTimestampIso).getTime();
    if (Number.isFinite(clientMs)) {
      skewSec = Math.round(Math.abs(now.getTime() - clientMs) / 1000);
      clockPass = skewSec <= s.maxClockSkewSec;
    }
  }
  layers.push({
    layer: 3,
    code: "CLOCK_SKEW_DETECTED",
    passed: clockPass,
    detail: clockPass ? `Vaqt farqi: ${skewSec}s` : `Telefon soati serverdan ${skewSec}s farq qilmoqda`
  });

  // 4. Gallery Upload Block
  const galleryPass = !(s.blockGalleryPhotos && input.fromGallery === true);
  layers.push({
    layer: 4,
    code: "GALLERY_MEDIA_BLOCKED",
    passed: galleryPass,
    detail: galleryPass ? "Jonli kamera" : "Galereyadan yuklangan media rad etildi"
  });

  // 5. Single Face Check
  const fc = input.faceCount ?? 1;
  const singleFacePass = !s.requireSingleFace || fc === 1;
  layers.push({
    layer: 5,
    code: "MULTIPLE_OR_NO_FACES",
    passed: singleFacePass,
    detail: singleFacePass ? "Kadrda 1 ta yuz" : `Kadrda yuzlar soni noto'g'ri: ${fc}`
  });

  // 6. Liveness 4/8 Directions
  const liveRes = input.skipLiveness
    ? { ok: true, validDirections: [] }
    : validateLivenessSteps(input.livenessSteps, s.livenessDirections);
  layers.push({
    layer: 6,
    code: "LIVENESS_FAILED",
    passed: liveRes.ok,
    detail: liveRes.ok ? `Liveness (${s.livenessDirections} yo'nalish) tasdiqlandi` : liveRes.reason ?? "Liveness xato"
  });

  // 7. Face Match Threshold
  const threshold = input.useSfaceThreshold ? s.sfaceThreshold : s.faceMatchThreshold;
  const score = input.faceScore ?? 1;
  const facePass = Boolean(input.skipFaceMatch) || score >= threshold;
  layers.push({
    layer: 7,
    code: "FACE_MISMATCH",
    passed: facePass,
    detail: facePass
      ? `Face ID mosligi: ${(score * 100).toFixed(1)}%`
      : `Yuz mos kelmadi (${(score * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%)`
  });

  // 8. Dual Camera (Front + Back)
  const dualPass = Boolean(input.skipDualCamera) || !s.requireDualCameraPhoto || input.hasBackPhotoOrVideo !== false;
  layers.push({
    layer: 8,
    code: "BACK_CAMERA_MISSING",
    passed: dualPass,
    detail: dualPass ? "Old va orqa kamera mavjud" : "Orqa kamera tasviri yuborilmadi"
  });

  // 9. Daily 3-Digit Code
  const codePass =
    input.expectedDayCode == null || Number(input.spokenDayCode) === Number(input.expectedDayCode);
  layers.push({
    layer: 9,
    code: "DAY_CODE_MISMATCH",
    passed: codePass,
    detail: codePass ? "Kunlik 3 xonali kod to'g'ri" : "Kunlik 3 xonali kod noto'g'ri"
  });

  // 10. Geofence & Mandatory Comment
  const commentTrim = (input.comment ?? "").trim();
  const geoPass = !(input.outsideGeofence && input.requireCommentOutside && commentTrim.length < 3);
  layers.push({
    layer: 10,
    code: "GEOFENCE_COMMENT_REQUIRED",
    passed: geoPass,
    detail: geoPass
      ? input.outsideGeofence
        ? `Geozonadan tashqarida (izoh: ${commentTrim})`
        : "Geozona ichida"
      : "Geozonadan tashqarida kamida 3 harfli izoh majburiy"
  });

  const firstFail = layers.find((l) => !l.passed) ?? null;
  return {
    ok: !firstFail,
    failedCode: firstFail?.code ?? null,
    failedMessage: firstFail?.detail ?? null,
    layers
  };
}
