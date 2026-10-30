import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import { sqlOrderMerchandiseNetReceivable } from "../orders/order-merchandise-net";

export type AssignmentDebtPersonKind = "agent" | "expeditor";

export type AssignmentDebtBlock = {
  kind: AssignmentDebtPersonKind;
  userId: number;
  slot: number;
  amount: string;
  /** Foydalanuvchiga sodda matn */
  messageRu: string;
};

const ZERO = new Prisma.Decimal(0);

/**
 * Agent/ekspeditor almashtirishga ruxsat faqat qoldiq == 0 bo‘lganda.
 * Peredoplata (ajratilgan > tovar) SQL da 0 ga keltiriladi → ruxsat.
 * Har qanday musbat qoldiq (> 0) → blok.
 */
export function hasBlockingAssignmentDebt(unpaid: Prisma.Decimal): boolean {
  return unpaid.gt(ZERO);
}

/** Yetkazilgan zakazlar qoldiq qarzi: mijoz + agent yoki ekspeditor. */
export async function sumUnpaidDeliveredForClientPerson(
  tenantId: number,
  clientId: number,
  person: { kind: AssignmentDebtPersonKind; userId: number },
  tx?: Prisma.TransactionClient
): Promise<Prisma.Decimal> {
  if (!Number.isFinite(clientId) || clientId < 1) return new Prisma.Decimal(0);
  if (!Number.isFinite(person.userId) || person.userId < 1) return new Prisma.Decimal(0);
  const db = tx ?? prisma;
  const personClause =
    person.kind === "agent"
      ? Prisma.sql`AND o.agent_id = ${person.userId}`
      : Prisma.sql`AND o.expeditor_user_id = ${person.userId}`;

  const rows = await db.$queryRaw<Array<{ unpaid: Prisma.Decimal }>>`
    WITH cand AS (
      SELECT o.id, o.total_sum, o.discount_sum, o.applied_auto_bonus_rule_ids
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.client_id = ${clientId}
        AND o.order_type = 'order'
        AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
        ${personClause}
    ),
    alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
        AND pa.order_id IN (SELECT id FROM cand)
      GROUP BY pa.order_id
    )
    SELECT COALESCE(SUM(GREATEST(${sqlOrderMerchandiseNetReceivable("c")} - COALESCE(a.allocated, 0), 0)), 0)::decimal(15,2) AS unpaid
    FROM cand c
    LEFT JOIN alloc a ON a.order_id = c.id
  `;
  return new Prisma.Decimal(rows[0]?.unpaid ?? 0);
}

export function formatAssignmentDebtBlockMessage(block: AssignmentDebtBlock): string {
  const role = block.kind === "agent" ? "агента" : "экспедитора (доставочника)";
  return (
    `Нельзя снять / заменить ${role} #${block.userId} (слот ${block.slot}): ` +
    `у клиента есть непогашенный долг по доставленным заказам этого сотрудника (${block.amount}). ` +
    `Смена разрешена только при остатке 0 (после полной оплаты). Переплата по заказам тоже даёт остаток 0 — тогда можно.`
  );
}

export function formatAssignmentDebtBlockMessageUz(block: AssignmentDebtBlock): string {
  const role = block.kind === "agent" ? "agentni" : "ekspeditor (dostavchik)ni";
  return (
    `${role} #${block.userId} (slot ${block.slot}) olib tashlab / almashtirib bo‘lmaydi: ` +
    `mijozda shu xodimning yetkazilgan zakazlari bo‘yicha to‘lanmagan qarz bor (${block.amount}). ` +
    `Faqat qoldiq 0 bo‘lganda ruxsat (to‘liq to‘lov). Peredoplata ham qoldiqni 0 qiladi — keyin mumkin.`
  );
}

/**
 * Oldingi agent/ekspeditor olib tashlanayotgan yoki almashtirilayotgan bo‘lsa —
 * qarz qoldig‘i > 0 bo‘lsa o‘zgarishni bloklash (oldingi qiymatni saqlash).
 */
export async function enforceAssignmentDebtLocks(params: {
  tenantId: number;
  clientId: number;
  prevBySlot: Map<
    number,
    { agent_id: number | null; expeditor_user_id: number | null }
  >;
  nextRows: Array<{
    slot: number;
    agent_id: number | null;
    expeditor_user_id: number | null;
  }>;
  tx?: Prisma.TransactionClient;
  /** Test inject */
  sumUnpaid?: typeof sumUnpaidDeliveredForClientPerson;
}): Promise<{ rows: typeof params.nextRows; blocks: AssignmentDebtBlock[] }> {
  const { tenantId, clientId, prevBySlot, tx } = params;
  const sumFn = params.sumUnpaid ?? sumUnpaidDeliveredForClientPerson;
  const nextBySlot = new Map(params.nextRows.map((r) => [r.slot, { ...r }]));
  const blocks: AssignmentDebtBlock[] = [];

  const allSlots = new Set<number>([...prevBySlot.keys(), ...nextBySlot.keys()]);

  for (const slot of allSlots) {
    const prev = prevBySlot.get(slot) ?? { agent_id: null, expeditor_user_id: null };
    const next = nextBySlot.get(slot) ?? {
      slot,
      agent_id: null,
      expeditor_user_id: null
    };

    if (prev.agent_id != null && prev.agent_id > 0 && prev.agent_id !== next.agent_id) {
      const amount = await sumFn(tenantId, clientId, { kind: "agent", userId: prev.agent_id }, tx);
      if (hasBlockingAssignmentDebt(amount)) {
        const block: AssignmentDebtBlock = {
          kind: "agent",
          userId: prev.agent_id,
          slot,
          amount: amount.toFixed(2),
          messageRu: ""
        };
        block.messageRu = formatAssignmentDebtBlockMessage(block);
        blocks.push(block);
        next.agent_id = prev.agent_id;
      }
    }

    if (
      prev.expeditor_user_id != null &&
      prev.expeditor_user_id > 0 &&
      prev.expeditor_user_id !== next.expeditor_user_id
    ) {
      const amount = await sumFn(
        tenantId,
        clientId,
        { kind: "expeditor", userId: prev.expeditor_user_id },
        tx
      );
      if (hasBlockingAssignmentDebt(amount)) {
        const block: AssignmentDebtBlock = {
          kind: "expeditor",
          userId: prev.expeditor_user_id,
          slot,
          amount: amount.toFixed(2),
          messageRu: ""
        };
        block.messageRu = formatAssignmentDebtBlockMessage(block);
        blocks.push(block);
        next.expeditor_user_id = prev.expeditor_user_id;
      }
    }

    nextBySlot.set(slot, next);
  }

  /** Faqat ma’lumotli slotlar (agent yoki ekspeditor) */
  const rows = [...nextBySlot.values()]
    .filter((r) => r.agent_id != null || r.expeditor_user_id != null)
    .sort((a, b) => a.slot - b.slot);

  return { rows, blocks };
}
