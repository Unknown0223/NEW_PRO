/** Zakaz: contract qulfi boshqa agentga tegishli bo‘lsa — taqiqlanadi. */
export function contractLockBlocksOtherAgent(
  assignment: { lock_type: string; agent_id: number | null } | null | undefined,
  agentId: number
): boolean {
  return (
    assignment?.lock_type === "contract" &&
    assignment.agent_id != null &&
    assignment.agent_id !== agentId
  );
}
