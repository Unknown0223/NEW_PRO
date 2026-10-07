/** Жорий ойнинг 1-санасидан жараён вақти бўйича бугунгача. */
export function monthToDateYmd(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}
