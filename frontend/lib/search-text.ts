/** Qidiruv so‘zlarini bo‘shliq bo‘yicha ajratadi. Tartib va ortiqcha bo‘shliq ahamiyatsiz. */
export function searchTokens(raw: string): string[] {
  return raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Har bir so‘z matn ichida alohida topsa — mos.
 * «Ibroximov Hamdam» «Hamdam Ibroximov» ichidan ham topiladi.
 */
export function matchesSearchTokens(haystack: string, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const hay = haystack.toLowerCase();
  return tokens.every((token) => hay.includes(token));
}
