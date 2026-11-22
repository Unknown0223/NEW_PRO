/** Tabel katak → jurnal otmetok deep-link (backend `tabel-day-marks-link.pure` bilan bir xil). */

export function dayMarksHref(userId: number, dateYmd: string, basePath = "/tabel/marks"): string | null {
  if (!Number.isFinite(userId) || userId <= 0) return null;
  const date = String(dateYmd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const params = new URLSearchParams({
    user_id: String(Math.trunc(userId)),
    from: date,
    to: date
  });
  return `${basePath}?${params.toString()}`;
}
