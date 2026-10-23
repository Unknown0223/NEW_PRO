/**
 * Agent ilovasidan yangi klient: darhol ro‘yxatda ko‘rinish va zakaz qoidalari.
 */
export function clientMatchesAgentScopeInput(
  client: {
    tenant_id: number;
    merged_into_client_id: number | null;
    agent_id: number | null;
    assignmentAgentIds?: Array<number | null>;
    assignmentWorkSlotIds?: Array<number | null>;
  },
  tenantId: number,
  agentId: number,
  workSlotId?: number | null
): boolean {
  if (client.tenant_id !== tenantId || client.merged_into_client_id != null) return false;
  if (client.agent_id === agentId) return true;
  if ((client.assignmentAgentIds ?? []).some((id) => id === agentId)) return true;
  if (workSlotId != null && workSlotId > 0) {
    if ((client.assignmentWorkSlotIds ?? []).some((id) => id === workSlotId)) return true;
  }
  return false;
}

/** «Подтверждение нового клиента» yoqilgandagina yangi klient aktiv. */
export function newClientActiveFromApprovalFlag(requireNewClientApproval: boolean | undefined): boolean {
  return requireNewClientApproval === true;
}

/** Sync/zakaz: aktiv + agent scope + contract qulfi boshqa agentda emas. */
export function createdClientImmediatelyOrderable(opts: {
  is_active: boolean;
  inAgentScope: boolean;
  contractLockBlocks: boolean;
}): boolean {
  return opts.is_active === true && opts.inAgentScope && !opts.contractLockBlocks;
}
