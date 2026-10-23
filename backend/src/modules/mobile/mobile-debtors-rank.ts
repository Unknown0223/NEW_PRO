/** Qarzdorlarni balans bo‘yicha tanlash: avval filter, keyin sort, oxirida limit. */
export function pickMobileDebtorsByBalance<T extends { balance: number }>(
  rows: T[],
  limit = 500
): T[] {
  const outLimit = Math.min(Math.max(limit, 1), 1000);
  return rows
    .filter((c) => c.balance < -0.01)
    .sort((a, b) => a.balance - b.balance)
    .slice(0, outLimit);
}
