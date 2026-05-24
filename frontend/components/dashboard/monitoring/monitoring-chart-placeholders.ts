/** Kunlik chiziq: oy kunlari bo‘yicha 0 qiymat (diagramma doim ko‘rinadi). */
export function buildMonthDailyPlaceholder(year: number, month: number): Array<{ day: string; revenue: number }> {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const day = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return { day, revenue: 0 };
  });
}
