export type NotifyPrefs = { off?: string[]; quiet?: boolean };

export const NOTIFY_TYPES = {
  client: ["order", "payment", "consignment", "reminder"],
  staff: ["order", "payment", "consignment", "bonus", "payroll", "task", "other"]
} as const;

export function readPrefs(raw: unknown): NotifyPrefs {
  const p = (raw ?? {}) as NotifyPrefs;
  return { off: Array.isArray(p.off) ? p.off.map(String) : [], quiet: p.quiet === true };
}
