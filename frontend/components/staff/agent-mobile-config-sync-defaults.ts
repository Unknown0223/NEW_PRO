/** Backend `defaultMobileConfigForRole('agent').sync` bilan mos. */
export const AGENT_SYNC_WINDOW_DEFAULTS = {
  allowed_window_from: "06:00",
  allowed_window_to: "22:00"
} as const;

export function effectiveSyncWindowFrom(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (t) return t;
  return AGENT_SYNC_WINDOW_DEFAULTS.allowed_window_from;
}

export function effectiveSyncWindowTo(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (t) return t;
  return AGENT_SYNC_WINDOW_DEFAULTS.allowed_window_to;
}

export function formatSyncWindowSummary(
  from: string | null | undefined,
  to: string | null | undefined
): string {
  return `${effectiveSyncWindowFrom(from)} — ${effectiveSyncWindowTo(to)}`;
}
