/** Qidiruv satrini so‘zlarga ajratadi. Tartib va ortiqcha bo‘shliq hisobga olinmaydi. */
export function searchTokens(raw: string | null | undefined): string[] {
  return (raw ?? "").trim().split(/\s+/).filter(Boolean);
}

/**
 * Har bir so‘z kamida bitta maydonda chiqishi kerak.
 * Bitta so‘z — oddiy OR. Bir nechta so‘z — AND(OR, OR, …).
 */
export function whereEverySearchToken<T extends object>(
  raw: string | null | undefined,
  orForToken: (token: string) => T[]
): { OR: T[] } | { AND: Array<{ OR: T[] }> } | null {
  const tokens = searchTokens(raw);
  if (tokens.length === 0) return null;
  const groups = tokens.map((token) => ({ OR: orForToken(token) }));
  if (groups.length === 1) return groups[0]!;
  return { AND: groups };
}
