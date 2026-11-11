/** Refresh reuse: grace ichida parallel refresh; undan tashqari — oila o‘g‘irligi. */
export type RefreshReuseDecision =
  | { action: "reject_expired" }
  | { action: "reject_reuse_theft" }
  | { action: "allow_grace_replay" }
  | { action: "rotate" };

export function decideRefreshReuse(args: {
  nowMs: number;
  expiresAtMs: number;
  revokedAtMs: number | null;
  graceMs: number;
}): RefreshReuseDecision {
  if (args.expiresAtMs < args.nowMs) {
    return { action: "reject_expired" };
  }
  if (args.revokedAtMs == null) {
    return { action: "rotate" };
  }
  if (args.nowMs - args.revokedAtMs <= args.graceMs) {
    return { action: "allow_grace_replay" };
  }
  return { action: "reject_reuse_theft" };
}
