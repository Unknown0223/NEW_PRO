/** Ish mintaqasi (UTC+5) — backend `workRegionTodayKey` bilan bir xil. */
export function workRegionTodayYmd(d = new Date()): string {
  const wr = new Date(d.getTime() + 5 * 3_600_000);
  return wr.toISOString().slice(0, 10);
}
