import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  orderMerchandiseNetReceivable,
  sqlOrderMerchandiseNetReceivable,
  type OrderMerchandiseRuleHint
} from "../orders/order-merchandise-net";
import { LARGE_CLIENT_IDS_CHUNK } from "./client-balances.constants";
import { sqlIntIdToNumber } from "./client-balances.payments.util";

export type ClientDebtSplit = {
  legacy_debt: Prisma.Decimal;
  current_debt: Prisma.Decimal;
  total_debt: Prisma.Decimal;
  /** Eski qarz egasi agent(lar) nomi, vergul bilan. */
  legacy_agent_names: string | null;
  /** Joriy agent nomi (current_debt > 0 bo‘lsa). */
  current_agent_name: string | null;
  /** Eski qarz agent id lari (kartochka ko‘rinishi / arxiv tekshiruvi). */
  legacy_agent_ids: number[];
};

export type OrderRemainderHint = {
  agent_id: number | null;
  remainder: Prisma.Decimal;
  agent_name?: string | null;
};

export type SplitDebtOptions = {
  /**
   * Nofaol (bo‘shatilgan / arxiv) agentlar: ularning qoldiq qarzi
   * joriy (workplace) agentning `current_debt`iga o‘tadi.
   */
  inactiveAgentIds?: ReadonlySet<number>;
  /** current_debt > 0 bo‘lganda ko‘rsatish uchun joriy agent nomi. */
  currentAgentName?: string | null;
};

function emptySplit(): ClientDebtSplit {
  return {
    legacy_debt: new Prisma.Decimal(0),
    current_debt: new Prisma.Decimal(0),
    total_debt: new Prisma.Decimal(0),
    legacy_agent_names: null,
    current_agent_name: null,
    legacy_agent_ids: []
  };
}

/**
 * Pure: joriy workplace agent buyurtmalari vs boshqa **faol** agentlar (legacy).
 * Bo‘shatilgan agent qarzlari joriy agent `current_debt`iga qo‘shiladi.
 */
export function splitDebtFromOrderRemainders(
  rows: OrderRemainderHint[],
  currentAgentId: number | null | undefined,
  opts?: SplitDebtOptions
): ClientDebtSplit {
  let legacy = new Prisma.Decimal(0);
  let current = new Prisma.Decimal(0);
  const cur =
    currentAgentId != null && Number.isFinite(currentAgentId) && currentAgentId > 0
      ? Number(currentAgentId)
      : null;
  const inactive = opts?.inactiveAgentIds;
  const legacyNames = new Map<number, string>();
  let currentName: string | null = (opts?.currentAgentName ?? "").trim() || null;

  for (const r of rows) {
    if (!r.remainder.gt(0)) continue;
    const label = (r.agent_name ?? "").trim() || (r.agent_id != null ? `#${r.agent_id}` : "");
    const orderAgent = r.agent_id != null && r.agent_id > 0 ? r.agent_id : null;
    const isOwnOrder = cur != null && orderAgent === cur;
    const isFiredOrUnknown =
      cur != null && (orderAgent == null || (inactive != null && inactive.has(orderAgent)));

    if (isOwnOrder || isFiredOrUnknown) {
      current = current.add(r.remainder);
      if (isOwnOrder && label) currentName = currentName ?? label;
    } else {
      legacy = legacy.add(r.remainder);
      if (orderAgent != null && label) legacyNames.set(orderAgent, label);
    }
  }

  const legacyList = [...legacyNames.values()];
  return {
    legacy_debt: legacy,
    current_debt: current,
    total_debt: legacy.add(current),
    legacy_agent_names: legacyList.length > 0 ? legacyList.join(", ") : null,
    current_agent_name: current.gt(0) ? currentName : null,
    legacy_agent_ids: [...legacyNames.keys()]
  };
}

/**
 * Mijozning real-time agent ish o‘rni: slotdagi joriy xodim → slot1.agent_id → clients.agent_id.
 */
export async function loadWorkplaceAgentByClient(
  tenantId: number,
  clientIds: number[],
  fallbackAgentByClient?: Map<number, number | null>
): Promise<Map<number, number | null>> {
  const map = new Map<number, number | null>();
  for (const id of clientIds) {
    map.set(id, fallbackAgentByClient?.get(id) ?? null);
  }
  if (clientIds.length === 0) return map;

  for (let i = 0; i < clientIds.length; i += LARGE_CLIENT_IDS_CHUNK) {
    const chunk = clientIds.slice(i, i + LARGE_CLIENT_IDS_CHUNK);
    const assignments = await prisma.clientAgentAssignment.findMany({
      where: { tenant_id: tenantId, client_id: { in: chunk }, slot: 1 },
      select: { client_id: true, agent_id: true, work_slot_id: true }
    });

    const slotIds = [
      ...new Set(
        assignments
          .map((a) => a.work_slot_id)
          .filter((id): id is number => id != null && id > 0)
      )
    ];
    const userBySlot = new Map<number, number>();
    if (slotIds.length > 0) {
      const links = await prisma.slotUserLink.findMany({
        where: { tenant_id: tenantId, slot_id: { in: slotIds }, ended_at: null },
        select: { slot_id: true, user_id: true }
      });
      for (const l of links) {
        if (l.user_id > 0) userBySlot.set(l.slot_id, l.user_id);
      }
    }

    for (const a of assignments) {
      const fromSlot =
        a.work_slot_id != null && a.work_slot_id > 0 ? userBySlot.get(a.work_slot_id) : undefined;
      if (fromSlot != null && fromSlot > 0) {
        map.set(a.client_id, fromSlot);
      } else if (a.agent_id != null && a.agent_id > 0) {
        map.set(a.client_id, a.agent_id);
      }
    }
  }

  return map;
}

/** Bitta mijoz: unpaid delivered qoldiqlarini legacy/current ga bo‘lish. */
export async function splitClientDeliveryDebt(
  tenantId: number,
  clientId: number,
  currentAgentId?: number | null
): Promise<ClientDebtSplit> {
  let agentId = currentAgentId;
  if (agentId == null || !Number.isFinite(agentId) || agentId < 1) {
    const wp = await loadWorkplaceAgentByClient(tenantId, [clientId]);
    agentId = wp.get(clientId) ?? null;
    if (agentId == null || agentId < 1) {
      const c = await prisma.client.findFirst({
        where: { id: clientId, tenant_id: tenantId },
        select: { agent_id: true }
      });
      agentId = c?.agent_id ?? null;
    }
  }

  const rows = await prisma.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      order_type: "order",
      status: { in: [...ORDER_STATUSES_OUTSTANDING_RECEIVABLE] }
    },
    select: {
      id: true,
      agent_id: true,
      total_sum: true,
      discount_sum: true,
      applied_auto_bonus_rule_ids: true
    }
  });

  if (rows.length === 0) {
    return emptySplit();
  }

  const ruleIds = [...new Set(rows.flatMap((r) => r.applied_auto_bonus_rule_ids))];
  const ruleRows =
    ruleIds.length > 0
      ? await prisma.bonusRule.findMany({
          where: { tenant_id: tenantId, id: { in: ruleIds } },
          select: { id: true, type: true, discount_pct: true }
        })
      : [];
  const rulesById = new Map<number, OrderMerchandiseRuleHint>(
    ruleRows.map((r) => [
      r.id,
      { type: r.type, discount_pct: r.discount_pct != null ? Number(r.discount_pct) : null }
    ])
  );

  const orderIds = rows.map((r) => r.id);
  const grouped = await prisma.paymentAllocation.groupBy({
    by: ["order_id"],
    where: { tenant_id: tenantId, order_id: { in: orderIds } },
    _sum: { amount: true }
  });
  const allocatedByOrder = new Map<number, Prisma.Decimal>();
  for (const g of grouped) {
    allocatedByOrder.set(g.order_id, g._sum.amount ?? new Prisma.Decimal(0));
  }

  const agentIds = [
    ...new Set(
      [...rows.map((r) => r.agent_id), agentId].filter(
        (id): id is number => id != null && id > 0
      )
    )
  ];
  const agentRows =
    agentIds.length > 0
      ? await prisma.user.findMany({
          where: { tenant_id: tenantId, id: { in: agentIds } },
          select: { id: true, name: true, is_active: true }
        })
      : [];
  const nameById = new Map(agentRows.map((u) => [u.id, u.name]));
  const inactiveAgentIds = new Set(agentRows.filter((u) => !u.is_active).map((u) => u.id));

  const hints: OrderRemainderHint[] = rows.map((r) => {
    const net = orderMerchandiseNetReceivable(
      r.total_sum,
      r.discount_sum,
      r.applied_auto_bonus_rule_ids,
      rulesById
    );
    const allocated = allocatedByOrder.get(r.id) ?? new Prisma.Decimal(0);
    const rem = net.sub(allocated);
    return {
      agent_id: r.agent_id,
      agent_name: r.agent_id != null ? (nameById.get(r.agent_id) ?? null) : null,
      remainder: rem.gt(0) ? rem : new Prisma.Decimal(0)
    };
  });

  return splitDebtFromOrderRemainders(hints, agentId, {
    inactiveAgentIds,
    currentAgentName: agentId != null ? (nameById.get(agentId) ?? null) : null
  });
}

/**
 * Ko‘p mijoz: unpaid qoldiqlarini joriy workplace agent bo‘yicha legacy/current ga bo‘lish.
 * `currentAgentByClient` berilsa — shu map; aks holda workplace → `clients.agent_id`.
 */
export async function loadDebtSplitByClient(
  tenantId: number,
  clientIds: number[],
  currentAgentByClient?: Map<number, number | null>
): Promise<Map<number, ClientDebtSplit>> {
  const map = new Map<number, ClientDebtSplit>();
  if (clientIds.length === 0) return map;

  for (const id of clientIds) {
    map.set(id, emptySplit());
  }

  type Acc = ClientDebtSplit & {
    legacyIds: Set<number>;
    currentId: number | null;
  };
  const acc = new Map<number, Acc>();
  for (const id of clientIds) {
    acc.set(id, { ...emptySplit(), legacyIds: new Set(), currentId: null });
  }

  let workplaceMap = currentAgentByClient;
  if (!workplaceMap) {
    const fallback = new Map<number, number | null>();
    for (let i = 0; i < clientIds.length; i += LARGE_CLIENT_IDS_CHUNK) {
      const chunk = clientIds.slice(i, i + LARGE_CLIENT_IDS_CHUNK);
      const clients = await prisma.client.findMany({
        where: { tenant_id: tenantId, id: { in: chunk } },
        select: { id: true, agent_id: true }
      });
      for (const c of clients) fallback.set(c.id, c.agent_id);
    }
    workplaceMap = await loadWorkplaceAgentByClient(tenantId, clientIds, fallback);
  }

  type Row = {
    client_id: number;
    agent_id: number | null;
    client_agent_id: number | null;
    unpaid: Prisma.Decimal;
  };
  const allRows: Row[] = [];
  const allAgentIds = new Set<number>();

  for (let i = 0; i < clientIds.length; i += LARGE_CLIENT_IDS_CHUNK) {
    const chunk = clientIds.slice(i, i + LARGE_CLIENT_IDS_CHUNK);
    const rows = await prisma.$queryRaw<Row[]>`
      WITH cand AS (
        SELECT o.id, o.client_id, o.agent_id, o.total_sum, o.discount_sum, o.applied_auto_bonus_rule_ids,
               c.agent_id AS client_agent_id
        FROM orders o
        INNER JOIN clients c ON c.id = o.client_id AND c.tenant_id = o.tenant_id
        WHERE o.tenant_id = ${tenantId}
          AND o.order_type = 'order'
          AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
          AND o.client_id IN (${Prisma.join(chunk)})
      ),
      alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
          AND pa.order_id IN (SELECT id FROM cand)
        GROUP BY pa.order_id
      )
      SELECT
        cand.client_id,
        cand.agent_id,
        cand.client_agent_id,
        GREATEST(${sqlOrderMerchandiseNetReceivable("cand")} - COALESCE(a.allocated, 0), 0)::decimal(15,2) AS unpaid
      FROM cand
      LEFT JOIN alloc a ON a.order_id = cand.id
      WHERE GREATEST(${sqlOrderMerchandiseNetReceivable("cand")} - COALESCE(a.allocated, 0), 0) > 0
    `;
    allRows.push(...rows);
  }

  for (const r of allRows) {
    const agentId = r.agent_id != null ? sqlIntIdToNumber(r.agent_id) : null;
    if (agentId != null && agentId > 0) allAgentIds.add(agentId);
  }
  for (const id of workplaceMap.values()) {
    if (id != null && id > 0) allAgentIds.add(id);
  }

  const activeById = new Map<number, boolean>();
  const nameById = new Map<number, string>();
  if (allAgentIds.size > 0) {
    const users = await prisma.user.findMany({
      where: { tenant_id: tenantId, id: { in: [...allAgentIds] } },
      select: { id: true, name: true, is_active: true }
    });
    for (const u of users) {
      nameById.set(u.id, u.name);
      activeById.set(u.id, u.is_active);
    }
  }
  const inactiveAgentIds = new Set(
    [...activeById.entries()].filter(([, active]) => !active).map(([id]) => id)
  );

  for (const r of allRows) {
    const cid = sqlIntIdToNumber(r.client_id);
    if (!Number.isFinite(cid)) continue;
    const curOverride = workplaceMap.get(cid);
    const currentAgent =
      curOverride !== undefined
        ? curOverride
        : r.client_agent_id != null
          ? sqlIntIdToNumber(r.client_agent_id)
          : null;
    const agentId = r.agent_id != null ? sqlIntIdToNumber(r.agent_id) : null;
    const unpaid = new Prisma.Decimal(r.unpaid);
    const entry = acc.get(cid) ?? {
      ...emptySplit(),
      legacyIds: new Set<number>(),
      currentId: null as number | null
    };

    const hasCurrent =
      currentAgent != null && Number.isFinite(currentAgent) && currentAgent > 0;
    const isOwn = hasCurrent && agentId === currentAgent;
    const isFiredOrUnknown =
      hasCurrent && (agentId == null || agentId < 1 || inactiveAgentIds.has(agentId));

    if (isOwn || isFiredOrUnknown) {
      entry.current_debt = entry.current_debt.add(unpaid);
      entry.currentId = currentAgent!;
    } else {
      entry.legacy_debt = entry.legacy_debt.add(unpaid);
      if (agentId != null && agentId > 0) {
        entry.legacyIds.add(agentId);
      }
    }
    entry.total_debt = entry.legacy_debt.add(entry.current_debt);
    acc.set(cid, entry);
  }

  for (const [cid, entry] of acc) {
    const legacyNames = [...entry.legacyIds]
      .map((id) => nameById.get(id) ?? `#${id}`)
      .filter(Boolean);
    const wp = workplaceMap.get(cid);
    const currentId = entry.currentId ?? (wp != null && wp > 0 ? wp : null);
    map.set(cid, {
      legacy_debt: entry.legacy_debt,
      current_debt: entry.current_debt,
      total_debt: entry.total_debt,
      legacy_agent_names:
        entry.legacy_debt.gt(0) && legacyNames.length > 0 ? legacyNames.join(", ") : null,
      current_agent_name:
        entry.current_debt.gt(0) && currentId != null
          ? (nameById.get(currentId) ?? `#${currentId}`)
          : null,
      legacy_agent_ids: [...entry.legacyIds]
    });
  }

  return map;
}

/** Agent (order.agent_id) bo‘yicha unpaid delivered yig‘indi. */
export async function loadUnpaidDeliveredByOrderAgent(
  tenantId: number
): Promise<Map<number, Prisma.Decimal>> {
  const map = new Map<number, Prisma.Decimal>();
  const rows = await prisma.$queryRaw<
    Array<{ agent_id: number; unpaid: Prisma.Decimal }>
  >`
    WITH cand AS (
      SELECT o.id, o.agent_id, o.total_sum, o.discount_sum, o.applied_auto_bonus_rule_ids
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.agent_id IS NOT NULL
        AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
    ),
    alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS allocated
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
        AND pa.order_id IN (SELECT id FROM cand)
      GROUP BY pa.order_id
    )
    SELECT
      cand.agent_id,
      SUM(GREATEST(${sqlOrderMerchandiseNetReceivable("cand")} - COALESCE(a.allocated, 0), 0))::decimal(15,2) AS unpaid
    FROM cand
    LEFT JOIN alloc a ON a.order_id = cand.id
    GROUP BY cand.agent_id
    HAVING SUM(GREATEST(${sqlOrderMerchandiseNetReceivable("cand")} - COALESCE(a.allocated, 0), 0)) > 0.01
  `;
  for (const r of rows) {
    const aid = sqlIntIdToNumber(r.agent_id);
    if (!Number.isFinite(aid) || aid < 1) continue;
    map.set(aid, new Prisma.Decimal(r.unpaid));
  }
  return map;
}

/** Agentning tenant bo‘yicha unpaid delivered qoldig‘i. */
export async function sumUnpaidDeliveredRemainderForAgent(
  tenantId: number,
  agentId: number,
  tx?: Prisma.TransactionClient
): Promise<Prisma.Decimal> {
  const db = tx ?? prisma;
  const rows = await db.$queryRaw<Array<{ unpaid: Prisma.Decimal }>>`
    WITH cand AS (
      SELECT o.id, o.total_sum, o.discount_sum, o.applied_auto_bonus_rule_ids
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.agent_id = ${agentId}
        AND o.order_type = 'order'
        AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
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
