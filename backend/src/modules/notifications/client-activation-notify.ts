/** Client aktivlashganda bildirishnoma oluvchilar (sof). */
export function clientActivationNotifyRecipientIds(opts: {
  agent_id: number | null | undefined;
  assignment_agent_ids?: Array<number | null | undefined>;
  actor_user_id?: number | null;
}): number[] {
  const recipients = new Set<number>();
  if (opts.agent_id != null && opts.agent_id > 0) recipients.add(opts.agent_id);
  for (const id of opts.assignment_agent_ids ?? []) {
    if (id != null && id > 0) recipients.add(id);
  }
  if (opts.actor_user_id != null && opts.actor_user_id > 0) {
    recipients.delete(opts.actor_user_id);
  }
  return [...recipients].sort((a, b) => a - b);
}
