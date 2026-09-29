/**
 * KPI fakt — sof (pure) hisob: yetkazilgan zakaz qatorlari − qabul qilingan qaytarishlar.
 * Oy yetkazish sanasi bo'yicha; qaytarish asl zakazning oyi va agentiga yoziladi.
 */

export type KpiMetrics = { cost: number; count: number; volume: number; acb: number; order_count: number };

export const ZERO_METRICS: KpiMetrics = { cost: 0, count: 0, volume: 0, acb: 0, order_count: 0 };

export type FactLine = {
  order_id: number;
  agent_id: number | null;
  expeditor_user_id: number | null;
  work_slot_id: number | null;
  client_id: number;
  product_id: number;
  qty: number;
  total: number;
  volume_unit: number;
};

/** Zakaz × mahsulot bo'yicha qaytarilgan (pullik) miqdor. */
export type ReturnAlloc = { order_id: number; product_id: number; qty: number };

export type FactKey = { user_id: number; work_slot_id: number | null };

export type UserFact = {
  user_id: number;
  work_slot_id: number | null;
  byGroup: Map<number, KpiMetrics>;
  total: KpiMetrics;
  returned_sum: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function keyOf(userId: number, slotId: number | null): string {
  return `${userId}:${slotId ?? 0}`;
}

type Acc = {
  cost: number;
  count: number;
  volume: number;
  clients: Map<number, number>;
  orders: Map<number, number>;
};

function newAcc(): Acc {
  return { cost: 0, count: 0, volume: 0, clients: new Map(), orders: new Map() };
}

function addToAcc(a: Acc, clientId: number, orderId: number, cost: number, qty: number, volume: number) {
  a.cost += cost;
  a.count += qty;
  a.volume += volume;
  a.clients.set(clientId, (a.clients.get(clientId) ?? 0) + cost);
  a.orders.set(orderId, (a.orders.get(orderId) ?? 0) + cost);
}

function accToMetrics(a: Acc): KpiMetrics {
  let acb = 0;
  for (const v of a.clients.values()) if (v > 0.004) acb += 1;
  let oc = 0;
  for (const v of a.orders.values()) if (v > 0.004) oc += 1;
  return { cost: r2(a.cost), count: r2(a.count), volume: r2(a.volume), acb, order_count: oc };
}

/**
 * Agent (yoki boshqa `pick` bilan tanlangan odam) × ishchi o'rni bo'yicha sof fakt.
 * Qaytarilgan miqdor zakaz qatorining o'rtacha narxi bilan ayiriladi.
 */
export function aggregateKpiFact(
  lines: FactLine[],
  returns: ReturnAlloc[],
  productGroups: Map<number, number[]>,
  pick: (l: FactLine) => number | null = (l) => l.agent_id
): Map<string, UserFact> {
  const retLeft = new Map<string, number>();
  for (const r of returns) {
    const k = `${r.order_id}:${r.product_id}`;
    retLeft.set(k, (retLeft.get(k) ?? 0) + r.qty);
  }

  const groupAcc = new Map<string, Map<number, Acc>>();
  const totalAcc = new Map<string, Acc>();
  const returned = new Map<string, number>();
  const meta = new Map<string, FactKey>();

  for (const l of lines) {
    const uid = pick(l);
    if (uid == null || l.qty <= 0) continue;
    const key = keyOf(uid, l.work_slot_id);
    meta.set(key, { user_id: uid, work_slot_id: l.work_slot_id });

    const rk = `${l.order_id}:${l.product_id}`;
    const left = retLeft.get(rk) ?? 0;
    const retQty = Math.min(left, l.qty);
    if (retQty > 0) retLeft.set(rk, left - retQty);
    const unit = l.total / l.qty;
    const netQty = l.qty - retQty;
    const netCost = netQty * unit;
    const netVol = netQty * l.volume_unit;
    returned.set(key, (returned.get(key) ?? 0) + retQty * unit);

    const tot = totalAcc.get(key) ?? newAcc();
    addToAcc(tot, l.client_id, l.order_id, netCost, netQty, netVol);
    totalAcc.set(key, tot);

    const groups = productGroups.get(l.product_id) ?? [];
    let gm = groupAcc.get(key);
    if (!gm) {
      gm = new Map();
      groupAcc.set(key, gm);
    }
    for (const g of groups) {
      const a = gm.get(g) ?? newAcc();
      addToAcc(a, l.client_id, l.order_id, netCost, netQty, netVol);
      gm.set(g, a);
    }
  }

  const out = new Map<string, UserFact>();
  for (const [key, m] of meta) {
    const byGroup = new Map<number, KpiMetrics>();
    for (const [g, a] of groupAcc.get(key) ?? []) byGroup.set(g, accToMetrics(a));
    out.set(key, {
      user_id: m.user_id,
      work_slot_id: m.work_slot_id,
      byGroup,
      total: accToMetrics(totalAcc.get(key) ?? newAcc()),
      returned_sum: r2(returned.get(key) ?? 0)
    });
  }
  return out;
}

/** Bir odamning barcha o'rinlaridagi faktini jamlash (АКБ — mijozlar bo'yicha qayta sanaladi). */
export function mergeUserFacts(
  lines: FactLine[],
  returns: ReturnAlloc[],
  productGroups: Map<number, number[]>,
  userId: number,
  pick: (l: FactLine) => number | null = (l) => l.agent_id
): UserFact {
  const onlyUser = lines.filter((l) => pick(l) === userId).map((l) => ({ ...l, work_slot_id: null }));
  const agg = aggregateKpiFact(onlyUser, returns, productGroups, pick);
  return (
    agg.get(keyOf(userId, null)) ?? {
      user_id: userId,
      work_slot_id: null,
      byGroup: new Map(),
      total: { ...ZERO_METRICS },
      returned_sum: 0
    }
  );
}

export type PeriodReturnLine = { return_id: number; client_id: number; product_id: number; qty: number };
export type PeriodCandidate = { order_id: number; client_id: number; product_id: number; qty: number };

/**
 * Davr qaytarishi (zakazsiz): mijozning shu oraliqda yetkazilgan zakazlari bo'yicha
 * mahsulot miqdori ulushida taqsimlanadi. Taqsimlanmagani — diagnostika.
 */
export function allocatePeriodReturns(
  lines: PeriodReturnLine[],
  candidatesByReturn: Map<number, PeriodCandidate[]>
): { allocs: ReturnAlloc[]; unallocated: Array<{ return_id: number; product_id: number; qty: number }> } {
  const allocs: ReturnAlloc[] = [];
  const unallocated: Array<{ return_id: number; product_id: number; qty: number }> = [];
  for (const rl of lines) {
    const cands = (candidatesByReturn.get(rl.return_id) ?? []).filter(
      (c) => c.product_id === rl.product_id && c.client_id === rl.client_id && c.qty > 0
    );
    const totalQty = cands.reduce((s, c) => s + c.qty, 0);
    if (totalQty <= 0) {
      unallocated.push({ return_id: rl.return_id, product_id: rl.product_id, qty: rl.qty });
      continue;
    }
    const toAlloc = Math.min(rl.qty, totalQty);
    let left = toAlloc;
    cands.forEach((c, i) => {
      const share = i === cands.length - 1 ? left : Math.round(((toAlloc * c.qty) / totalQty) * 1000) / 1000;
      const q = Math.min(share, left);
      if (q > 0) allocs.push({ order_id: c.order_id, product_id: c.product_id, qty: q });
      left -= q;
    });
    if (rl.qty > totalQty) {
      unallocated.push({ return_id: rl.return_id, product_id: rl.product_id, qty: rl.qty - totalQty });
    }
  }
  return { allocs, unallocated };
}

export function sumMetrics(list: KpiMetrics[]): KpiMetrics {
  return list.reduce(
    (a, m) => ({
      cost: r2(a.cost + m.cost),
      count: r2(a.count + m.count),
      volume: r2(a.volume + m.volume),
      acb: a.acb + m.acb,
      order_count: a.order_count + m.order_count
    }),
    { ...ZERO_METRICS }
  );
}
