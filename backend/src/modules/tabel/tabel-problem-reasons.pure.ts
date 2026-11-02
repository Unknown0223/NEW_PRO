/** Проблемные отметки: sabab yorliqlari (ekranda kod emas). */

export type PunchProblemInput = {
  outside_geofence: boolean;
  face_score: number | null;
  is_valid: boolean;
  review_status: string;
  integrity_json: unknown;
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function failedCodes(integrity: unknown): Set<string> {
  const root = asObj(integrity);
  const codes = new Set<string>();
  const verdict = String(root.verdict ?? "").trim();
  if (verdict && verdict !== "ok") codes.add(verdict);
  const layers = Array.isArray(root.layers) ? root.layers : [];
  for (const layer of layers) {
    const row = asObj(layer);
    if (row.passed === false && row.code) codes.add(String(row.code));
  }
  return codes;
}

export function punchProblemLabels(p: PunchProblemInput): string[] {
  const failed = failedCodes(p.integrity_json);
  const labels: string[] = [];
  if (p.outside_geofence || failed.has("GEOFENCE_COMMENT_REQUIRED")) labels.push("Вне гео-зоны");
  if ((p.face_score != null && p.face_score < 0.85) || failed.has("FACE_MISMATCH")) labels.push("Лицо не совпало");
  if (failed.has("FAKE_GPS_DETECTED")) labels.push("Fake GPS");
  if (labels.length === 0 && !p.is_valid) {
    const msg = String(asObj(p.integrity_json).failedMessage ?? "").trim();
    labels.push(msg || "Нарушение");
  }
  if (labels.length === 0 && p.review_status === "pending") labels.push("Ожидает проверки");
  return labels;
}
