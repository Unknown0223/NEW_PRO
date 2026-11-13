/** Pure head-pose helpers for Face ID liveness (browser landmarks → direction). */

export type HeadPose = { yaw: number; pitch: number };

export type LivenessDir =
  | "left"
  | "right"
  | "up"
  | "down"
  | "up-left"
  | "up-right"
  | "down-left"
  | "down-right";

export type LandmarkPoint = { x: number; y: number; z?: number };

/** MediaPipe Face Mesh indices used for a lightweight pose proxy. */
export const POSE_LANDMARK = {
  nose: 1,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  forehead: 10,
  chin: 152
} as const;

/**
 * Thresholds in relative units (nose offset / eye-distance or face height).
 * Tuned for webcam selfie distance; relative-to-baseline makes absolute pose less critical.
 */
export const POSE_THRESHOLDS = {
  yaw: 0.14,
  pitch: 0.1,
  diagonalYaw: 0.1,
  diagonalPitch: 0.07,
  /** Consecutive matching analysis frames before auto-advance. */
  holdFrames: 3,
  /** Target analysis cadence (~12 fps). */
  analysisIntervalMs: 80,
  /** Ignore motion briefly after a new step so baseline can settle. */
  settleMs: 450,
  /** Soft progress toward threshold for UI (0..1). */
  progressSoftStart: 0.35
} as const;

/**
 * Estimate yaw/pitch from face landmarks (normalized image coords).
 * Convention (matches mirrored selfie UI labels):
 * - yaw > 0 → user turned head LEFT (Влево)
 * - pitch > 0 → user tilted head UP (Вверх)
 */
export function estimateHeadPoseFromLandmarks(landmarks: LandmarkPoint[]): HeadPose | null {
  if (!landmarks || landmarks.length < 264) return null;
  const nose = landmarks[POSE_LANDMARK.nose];
  const leftEye = landmarks[POSE_LANDMARK.leftEyeOuter];
  const rightEye = landmarks[POSE_LANDMARK.rightEyeOuter];
  const forehead = landmarks[POSE_LANDMARK.forehead];
  const chin = landmarks[POSE_LANDMARK.chin];
  if (!nose || !leftEye || !rightEye || !forehead || !chin) return null;

  const midEyeX = (leftEye.x + rightEye.x) / 2;
  const midEyeY = (leftEye.y + rightEye.y) / 2;
  const faceWidth = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
  const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  if (faceWidth < 1e-5 || faceHeight < 1e-5) return null;

  // Raw (unmirrored) frame: user left-turn moves nose toward larger x → yaw+ = left (UI «Влево»).
  // CSS scaleX(-1) only mirrors the <video> paint; MediaPipe reads raw pixels.
  const yaw = (nose.x - midEyeX) / faceWidth;
  // Looking up moves nose toward smaller y → pitch+ = up.
  const pitch = (midEyeY - nose.y) / faceHeight;
  return { yaw, pitch };
}

export function poseDelta(current: HeadPose, baseline: HeadPose): HeadPose {
  return {
    yaw: current.yaw - baseline.yaw,
    pitch: current.pitch - baseline.pitch
  };
}

function axisHit(value: number, threshold: number, wantPositive: boolean): boolean {
  return wantPositive ? value >= threshold : value <= -threshold;
}

/**
 * Whether the pose delta satisfies the required liveness direction.
 */
export function matchesRequiredDirection(
  delta: HeadPose,
  required: string,
  thresholds: Pick<
    typeof POSE_THRESHOLDS,
    "yaw" | "pitch" | "diagonalYaw" | "diagonalPitch"
  > = POSE_THRESHOLDS
): boolean {
  const dir = required.trim().toLowerCase();
  switch (dir) {
    case "left":
      return axisHit(delta.yaw, thresholds.yaw, true);
    case "right":
      return axisHit(delta.yaw, thresholds.yaw, false);
    case "up":
      return axisHit(delta.pitch, thresholds.pitch, true);
    case "down":
      return axisHit(delta.pitch, thresholds.pitch, false);
    case "up-left":
      return (
        axisHit(delta.yaw, thresholds.diagonalYaw, true) &&
        axisHit(delta.pitch, thresholds.diagonalPitch, true)
      );
    case "up-right":
      return (
        axisHit(delta.yaw, thresholds.diagonalYaw, false) &&
        axisHit(delta.pitch, thresholds.diagonalPitch, true)
      );
    case "down-left":
      return (
        axisHit(delta.yaw, thresholds.diagonalYaw, true) &&
        axisHit(delta.pitch, thresholds.diagonalPitch, false)
      );
    case "down-right":
      return (
        axisHit(delta.yaw, thresholds.diagonalYaw, false) &&
        axisHit(delta.pitch, thresholds.diagonalPitch, false)
      );
    default:
      return false;
  }
}

/** 0..1 progress toward the required direction (for arrow feedback). */
export function directionProgress(
  delta: HeadPose,
  required: string,
  thresholds: Pick<
    typeof POSE_THRESHOLDS,
    "yaw" | "pitch" | "diagonalYaw" | "diagonalPitch"
  > = POSE_THRESHOLDS
): number {
  const dir = required.trim().toLowerCase();
  const ratio = (value: number, thr: number, wantPositive: boolean) => {
    const v = wantPositive ? value : -value;
    return Math.max(0, Math.min(1, v / thr));
  };

  switch (dir) {
    case "left":
      return ratio(delta.yaw, thresholds.yaw, true);
    case "right":
      return ratio(delta.yaw, thresholds.yaw, false);
    case "up":
      return ratio(delta.pitch, thresholds.pitch, true);
    case "down":
      return ratio(delta.pitch, thresholds.pitch, false);
    case "up-left":
      return Math.min(
        ratio(delta.yaw, thresholds.diagonalYaw, true),
        ratio(delta.pitch, thresholds.diagonalPitch, true)
      );
    case "up-right":
      return Math.min(
        ratio(delta.yaw, thresholds.diagonalYaw, false),
        ratio(delta.pitch, thresholds.diagonalPitch, true)
      );
    case "down-left":
      return Math.min(
        ratio(delta.yaw, thresholds.diagonalYaw, true),
        ratio(delta.pitch, thresholds.diagonalPitch, false)
      );
    case "down-right":
      return Math.min(
        ratio(delta.yaw, thresholds.diagonalYaw, false),
        ratio(delta.pitch, thresholds.diagonalPitch, false)
      );
    default:
      return 0;
  }
}

/**
 * Classify strongest cardinal/diagonal from a delta (for tests / debug).
 * Returns null if below soft thresholds.
 */
export function classifyDirectionFromDelta(
  delta: HeadPose,
  mode: 4 | 8 = 4,
  thresholds: Pick<
    typeof POSE_THRESHOLDS,
    "yaw" | "pitch" | "diagonalYaw" | "diagonalPitch"
  > = POSE_THRESHOLDS
): LivenessDir | null {
  const absYaw = Math.abs(delta.yaw);
  const absPitch = Math.abs(delta.pitch);
  const yawSign = delta.yaw >= 0 ? "left" : "right";
  const pitchSign = delta.pitch >= 0 ? "up" : "down";

  if (mode === 8) {
    const strongYaw = absYaw >= thresholds.diagonalYaw;
    const strongPitch = absPitch >= thresholds.diagonalPitch;
    if (strongYaw && strongPitch) {
      return `${pitchSign}-${yawSign}` as LivenessDir;
    }
  }

  if (absYaw >= thresholds.yaw && absYaw >= absPitch) {
    return yawSign;
  }
  if (absPitch >= thresholds.pitch) {
    return pitchSign;
  }
  return null;
}
