/** Sana +05. Soat manbada bo‘lsa o‘sha soat; faqat sana bo‘lsa 06:00 (kalendar kuni Toshkentda). */
export function salesDocInstant(date: string): Date {
  const m = date.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  if (!m) return new Date("2000-01-01T06:00:00+05:00");
  if (m[2]) {
    const clock = m[2].length === 5 ? `${m[2]}:00` : m[2];
    return new Date(`${m[1]}T${clock}+05:00`);
  }
  return new Date(`${m[1]}T06:00:00+05:00`);
}

/** Zakaz urilgan oyning oxirgi kuni, 06:00 +05. Muddat bo‘lmasa shu qo‘yiladi. */
export function salesDocMonthEnd(date: string): Date {
  const m = date.trim().match(/^(\d{4})-(\d{2})-/);
  if (!m) return new Date("2000-01-31T06:00:00+05:00");
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return new Date(`${m[1]}-${m[2]}-${String(last).padStart(2, "0")}T06:00:00+05:00`);
}
