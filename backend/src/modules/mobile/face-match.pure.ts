/** Pure face descriptor math — unit-testable without sharp/fs. */

export const DEFAULT_FACE_MATCH_THRESHOLD = 0.88;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na <= 0 || nb <= 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Score 0..1 (cosine clipped). */
export function faceMatchScore(reference: number[], probe: number[]): number {
  const s = cosineSimilarity(reference, probe);
  if (!Number.isFinite(s)) return 0;
  return Math.max(0, Math.min(1, s));
}

export function decideFaceMatch(
  score: number,
  threshold = DEFAULT_FACE_MATCH_THRESHOLD
): "approved" | "rejected" {
  return score >= threshold ? "approved" : "rejected";
}

export function parseDescriptor(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length < 16) return null;
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

export function l2Normalize(vec: number[]): number[] {
  let sum = 0;
  for (const v of vec) sum += v * v;
  const n = Math.sqrt(sum);
  if (n <= 1e-9) return vec.map(() => 0);
  return vec.map((v) => v / n);
}
