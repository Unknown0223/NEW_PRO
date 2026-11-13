/** Geometric face fingerprint from MediaPipe-style landmarks (normalized 0..1). */

export type LandmarkXY = { x: number; y: number };

/** Sparse mesh indices — stable across Face Landmarker versions. */
const IDX = {
  nose: 1,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftEyeInner: 133,
  rightEyeInner: 362,
  forehead: 10,
  chin: 152,
  mouthLeft: 61,
  mouthRight: 291,
  mouthTop: 13,
  mouthBottom: 14,
  leftCheek: 234,
  rightCheek: 454
} as const;

const PAIRS: Array<[keyof typeof IDX, keyof typeof IDX]> = [
  ["leftEyeOuter", "rightEyeOuter"],
  ["leftEyeInner", "rightEyeInner"],
  ["nose", "forehead"],
  ["nose", "chin"],
  ["mouthLeft", "mouthRight"],
  ["mouthTop", "mouthBottom"],
  ["leftCheek", "rightCheek"],
  ["leftEyeOuter", "nose"],
  ["rightEyeOuter", "nose"],
  ["leftEyeOuter", "mouthLeft"],
  ["rightEyeOuter", "mouthRight"],
  ["forehead", "chin"],
  ["leftCheek", "chin"],
  ["rightCheek", "chin"],
  ["nose", "mouthTop"]
];

/** Strict: landmark alone must never open the door; used only as AND with pixel. */
export const DEFAULT_LANDMARK_MATCH_THRESHOLD = 0.9;

function dist(a: LandmarkXY, b: LandmarkXY): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function buildLandmarkDescriptor(landmarks: LandmarkXY[]): number[] | null {
  if (!Array.isArray(landmarks) || landmarks.length < 400) return null;
  const pts: LandmarkXY[] = [];
  for (const key of Object.keys(IDX) as Array<keyof typeof IDX>) {
    const p = landmarks[IDX[key]];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
    pts.push({ x: p.x, y: p.y });
  }
  const left = landmarks[IDX.leftEyeOuter]!;
  const right = landmarks[IDX.rightEyeOuter]!;
  const scale = dist(left, right);
  if (scale < 1e-5) return null;

  const out: number[] = [];
  for (const [ka, kb] of PAIRS) {
    const a = landmarks[IDX[ka]]!;
    const b = landmarks[IDX[kb]]!;
    out.push(dist(a, b) / scale);
  }
  return out;
}

export function landmarkMatchScore(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i]! - b[i]!);
  }
  const mean = sum / a.length;
  /* mean abs relative-distance error → similarity 0..1 */
  return Math.max(0, Math.min(1, 1 - mean / 0.45));
}

export function decideLandmarkMatch(
  score: number,
  threshold = DEFAULT_LANDMARK_MATCH_THRESHOLD
): boolean {
  return score >= threshold;
}

export function parseLandmarkDescriptor(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 8) return null;
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}
