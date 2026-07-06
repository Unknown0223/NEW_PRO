import { prisma } from "../../config/database";

export type AgentConsignmentMonthStatusRow = {
  id: number;
  tenant_id: number;
  agent_user_id: number;
  year: number;
  month: number;
  period_closed_at: Date | null;
  debt_cleared_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/** Prisma client yangilanmaguncha faqat SQL — stale runtime xatosini oldini oladi. */
export async function findAgentConsignmentMonthStatus(
  tenantId: number,
  agentUserId: number,
  year: number,
  month: number
): Promise<AgentConsignmentMonthStatusRow | null> {
  const rows = await prisma.$queryRaw<AgentConsignmentMonthStatusRow[]>`
    SELECT id, tenant_id, agent_user_id, year, month, period_closed_at, debt_cleared_at, created_at, updated_at
    FROM agent_consignment_month_status
    WHERE tenant_id = ${tenantId} AND agent_user_id = ${agentUserId} AND year = ${year} AND month = ${month}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listAgentConsignmentMonthStatusForMonth(
  tenantId: number,
  year: number,
  month: number
): Promise<Array<Pick<AgentConsignmentMonthStatusRow, "agent_user_id" | "period_closed_at" | "debt_cleared_at">>> {
  return prisma.$queryRaw`
    SELECT agent_user_id, period_closed_at, debt_cleared_at
    FROM agent_consignment_month_status
    WHERE tenant_id = ${tenantId} AND year = ${year} AND month = ${month}
  `;
}

export async function upsertAgentConsignmentMonthStatus(input: {
  tenant_id: number;
  agent_user_id: number;
  year: number;
  month: number;
  period_closed_at: Date | null;
  debt_cleared_at: Date | null;
}): Promise<AgentConsignmentMonthStatusRow> {
  const rows = await prisma.$queryRaw<AgentConsignmentMonthStatusRow[]>`
    INSERT INTO agent_consignment_month_status (
      tenant_id, agent_user_id, year, month, period_closed_at, debt_cleared_at, updated_at
    )
    VALUES (
      ${input.tenant_id},
      ${input.agent_user_id},
      ${input.year},
      ${input.month},
      ${input.period_closed_at},
      ${input.debt_cleared_at},
      NOW()
    )
    ON CONFLICT (tenant_id, agent_user_id, year, month)
    DO UPDATE SET
      period_closed_at = EXCLUDED.period_closed_at,
      debt_cleared_at = EXCLUDED.debt_cleared_at,
      updated_at = NOW()
    RETURNING id, tenant_id, agent_user_id, year, month, period_closed_at, debt_cleared_at, created_at, updated_at
  `;
  const row = rows[0];
  if (!row) throw new Error("UPSERT_MONTH_STATUS_FAILED");
  return row;
}
