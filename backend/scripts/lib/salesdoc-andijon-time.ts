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
