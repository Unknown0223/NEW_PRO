import { Prisma } from "@prisma/client";
import {
  type AgentAssignmentPatch,
  type ClientAgentAssignmentApi,
  parseVisitWeekdaysJson
} from "./clients.types";
import { CONTACT_SLOTS } from "./clients.helpers";


function visitWeekdaysToPrismaJson(days: number[]): Prisma.InputJsonValue {
  const clean = parseVisitWeekdaysJson(days);
  return clean as unknown as Prisma.InputJsonValue;
}

export function mapAgentAssignmentsToApi(
  rows: Array<{
    id?: number;
    slot: number;
    agent_id: number | null;
    visit_date: Date | null;
    expeditor_phone: string | null;
    visit_weekdays: unknown;
    expeditor_user_id: number | null;
    lock_type?: string;
    lock_reason?: string | null;
    auto_assign_status?: string;
    work_slot_id?: number | null;
    agent: { name: string; code: string | null } | null;
    expeditor_user: { id: number; name: string } | null;
    work_slot?: { slot_code: string } | null;
  }>
): ClientAgentAssignmentApi[] {
  return rows.map((r) => ({
    id: r.id,
    slot: r.slot,
    agent_id: r.agent_id,
    agent_name: r.agent?.name ?? null,
    agent_code: r.agent?.code?.trim() ? r.agent.code.trim() : null,
    visit_date: r.visit_date?.toISOString() ?? null,
    expeditor_phone: r.expeditor_phone,
    visit_weekdays: parseVisitWeekdaysJson(r.visit_weekdays),
    expeditor_user_id: r.expeditor_user_id,
    expeditor_name: r.expeditor_user?.name ?? null,
    lock_type: r.lock_type ?? "none",
    lock_reason: r.lock_reason ?? null,
    auto_assign_status: r.auto_assign_status ?? "assigned",
    work_slot_id: r.work_slot_id ?? null,
    work_slot_code: r.work_slot?.slot_code ?? null
  }));
}

export const agentAssignmentSelectFields = {
  id: true,
  slot: true,
  agent_id: true,
  visit_date: true,
  expeditor_phone: true,
  visit_weekdays: true,
  expeditor_user_id: true,
  lock_type: true,
  lock_reason: true,
  auto_assign_status: true,
  work_slot_id: true,
  agent: { select: { name: true, code: true } },
  expeditor_user: { select: { id: true, name: true } },
  work_slot: { select: { slot_code: true } }
} as const;

export function mergeAgentDisplayFromAssignments(
  legacyAgentId: number | null,
  legacyAgentName: string | null,
  legacyVisitIso: string | null,
  assignments: ClientAgentAssignmentApi[]
): { agent_id: number | null; agent_name: string | null; visit_date: string | null } {
  const s1 = assignments.find((a) => a.slot === 1);
  if (s1) {
    return {
      agent_id: s1.agent_id,
      agent_name: s1.agent_name,
      visit_date: s1.visit_date
    };
  }
  return {
    agent_id: legacyAgentId,
    agent_name: legacyAgentName,
    visit_date: legacyVisitIso
  };
}

type ReplaceClientAgentAssignmentsOptions = {
  /** Importda IDlar staff lookup bilan allaqachon tekshirilgan bo‘lsa, `user.findFirst` takrorini o‘chirish. */
  skipStaffDbValidation?: boolean;
};

export async function replaceClientAgentAssignments(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  raw: AgentAssignmentPatch[],
  options?: ReplaceClientAgentAssignmentsOptions
): Promise<void> {
  const skipStaffDbValidation = options?.skipStaffDbValidation === true;
  const bySlot = new Map<number, AgentAssignmentPatch>();
  for (const s of raw) {
    const slot = Math.floor(Number(s.slot));
    if (slot < 1 || slot > CONTACT_SLOTS) {
      throw new Error("VALIDATION");
    }
    bySlot.set(slot, s);
  }

  const rows: Array<{
    slot: number;
    agent_id: number | null;
    visit_date: Date | null;
    expeditor_phone: string | null;
    expeditor_user_id: number | null;
    visit_weekdays: Prisma.InputJsonValue;
  }> = [];

  for (const slot of [...bySlot.keys()].sort((a, b) => a - b)) {
    const s = bySlot.get(slot)!;
    let agent_id: number | null = null;
    if (s.agent_id != null) {
      const uid = Math.floor(Number(s.agent_id));
      if (!Number.isFinite(uid) || uid < 1) {
        throw new Error("VALIDATION");
      }
      if (skipStaffDbValidation) {
        agent_id = uid;
      } else {
        const u = await tx.user.findFirst({
          where: { id: uid, tenant_id: tenantId, is_active: true }
        });
        if (!u) {
          throw new Error("VALIDATION");
        }
        agent_id = uid;
      }
    }

    let visit_date: Date | null = null;
    if (s.visit_date != null && String(s.visit_date).trim() !== "") {
      const d = new Date(s.visit_date as string);
      if (Number.isNaN(d.getTime())) {
        throw new Error("VALIDATION");
      }
      visit_date = d;
    }

    const expeditor_phone = s.expeditor_phone?.trim() || null;

    let expeditor_user_id: number | null = null;
    if (s.expeditor_user_id != null) {
      const eid = Math.floor(Number(s.expeditor_user_id));
      if (!Number.isFinite(eid) || eid < 1) {
        throw new Error("VALIDATION");
      }
      if (skipStaffDbValidation) {
        expeditor_user_id = eid;
      } else {
        const eu = await tx.user.findFirst({
          where: { id: eid, tenant_id: tenantId, is_active: true }
        });
        if (!eu) {
          throw new Error("VALIDATION");
        }
        expeditor_user_id = eid;
      }
    }

    const weekdaysJson = visitWeekdaysToPrismaJson(s.visit_weekdays ?? []);
    const weekdaysArr = parseVisitWeekdaysJson(s.visit_weekdays);

    const hasData =
      agent_id != null ||
      visit_date != null ||
      (expeditor_phone != null && expeditor_phone.length > 0) ||
      expeditor_user_id != null ||
      weekdaysArr.length > 0;
    if (!hasData) continue;

    rows.push({
      slot,
      agent_id,
      visit_date,
      expeditor_phone,
      expeditor_user_id,
      visit_weekdays: weekdaysJson
    });
  }

  await tx.clientAgentAssignment.deleteMany({ where: { client_id: clientId } });
  if (rows.length > 0) {
    await tx.clientAgentAssignment.createMany({
      data: rows.map((r) => ({
        tenant_id: tenantId,
        client_id: clientId,
        slot: r.slot,
        agent_id: r.agent_id,
        visit_date: r.visit_date,
        expeditor_phone: r.expeditor_phone,
        expeditor_user_id: r.expeditor_user_id,
        visit_weekdays: r.visit_weekdays
      }))
    });
  }

  const s1 = rows.find((r) => r.slot === 1);
  await tx.client.update({
    where: { id: clientId },
    data: {
      agent_id: s1?.agent_id ?? null,
      visit_date: s1?.visit_date ?? null
    }
  });
}

export async function syncAssignmentSlotOneWithClientRow(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number
): Promise<void> {
  const c = await tx.client.findUnique({
    where: { id: clientId },
    select: { agent_id: true, visit_date: true }
  });
  if (!c) return;

  const existing = await tx.clientAgentAssignment.findUnique({
    where: { client_id_slot: { client_id: clientId, slot: 1 } }
  });

  const hasLegacy = c.agent_id != null || c.visit_date != null;

  if (!hasLegacy) {
    if (existing) {
      await tx.clientAgentAssignment.delete({
        where: { client_id_slot: { client_id: clientId, slot: 1 } }
      });
    }
    return;
  }

  if (existing) {
    await tx.clientAgentAssignment.update({
      where: { client_id_slot: { client_id: clientId, slot: 1 } },
      data: {
        agent_id: c.agent_id,
        visit_date: c.visit_date
      }
    });
  } else {
    await tx.clientAgentAssignment.create({
      data: {
        tenant_id: tenantId,
        client_id: clientId,
        slot: 1,
        agent_id: c.agent_id,
        visit_date: c.visit_date,
        expeditor_phone: null,
        expeditor_user_id: null,
        visit_weekdays: []
      }
    });
  }
}
