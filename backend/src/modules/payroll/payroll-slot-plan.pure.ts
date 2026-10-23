import { ZERO_METRICS, type KpiMetrics } from "./payroll-kpi-fact.pure";

export type SlotHolder = { userId: number; startYmd: string; endYmdExcl: string | null };

export type SlotPlanShare = {
  plan: KpiMetrics;
  days: number;
  slot_days: number;
  source: "share" | "explicit" | "owner_full";
};

export type SlotPlanSplit = {
  shares: Map<number, SlotPlanShare>;
  vacantDays: number;
  ownerUserId: number | null;
  warnings: string[];
};

export function hasAnyMetric(m: KpiMetrics | undefined | null): boolean {
  return Boolean(m && (m.cost > 0 || m.count > 0 || m.volume > 0 || m.acb > 0 || m.order_count > 0));
}

export function scaleMetrics(m: KpiMetrics, k: number): KpiMetrics {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    cost: r2(m.cost * k),
    count: r2(m.count * k),
    volume: r2(m.volume * k),
    acb: Math.round(m.acb * k),
    order_count: Math.round(m.order_count * k)
  };
}

export function holderDays(h: SlotHolder, slotWorkingDays: string[]): string[] {
  return slotWorkingDays.filter((d) => d >= h.startYmd && (h.endYmdExcl == null || d < h.endYmdExcl));
}

/**
 * Ishchi o'rni rejasi (oy boshidagi egasining targeti) egalariga o'rinda ishlagan
 * ish kunlari ulushida bo'linadi — jami 1×. Keyingi egaga rahbar aniq target qo'ygan
 * bo'lsa, u ustun turadi. Bo'sh kunlar hech kimga berilmaydi.
 */
export function splitSlotPlan(input: {
  slotWorkingDays: string[];
  holders: SlotHolder[];
  targets: Map<number, KpiMetrics>;
}): SlotPlanSplit {
  const warnings: string[] = [];
  const shares = new Map<number, SlotPlanShare>();
  const total = input.slotWorkingDays.length;
  const ordered = [...input.holders].sort((a, b) => a.startYmd.localeCompare(b.startYmd));
  const owner = ordered.find((h) => hasAnyMetric(input.targets.get(h.userId)));
  const slotPlan = owner ? input.targets.get(owner.userId)! : null;

  const occupied = new Set<string>();
  const perHolderDays = new Map<number, number>();
  for (const h of ordered) {
    const days = holderDays(h, input.slotWorkingDays);
    days.forEach((d) => occupied.add(d));
    perHolderDays.set(h.userId, (perHolderDays.get(h.userId) ?? 0) + days.length);
  }

  let explicitSum = 0;
  let shareSum = 0;
  for (const [userId, days] of perHolderDays) {
    const own = input.targets.get(userId);
    const isOwner = owner?.userId === userId;
    if (!isOwner && hasAnyMetric(own)) {
      shares.set(userId, { plan: own!, days, slot_days: total, source: "explicit" });
      explicitSum += own!.cost;
      continue;
    }
    if (!slotPlan || total === 0) {
      shares.set(userId, { plan: { ...ZERO_METRICS }, days, slot_days: total, source: "share" });
      continue;
    }
    const k = days / total;
    const plan = scaleMetrics(slotPlan, k);
    shareSum += plan.cost;
    shares.set(userId, { plan, days, slot_days: total, source: k >= 1 ? "owner_full" : "share" });
  }

  if (explicitSum > 0 && slotPlan && Math.abs(explicitSum + shareSum - slotPlan.cost) > 1) {
    warnings.push("slot_plan_sum_mismatch");
  }
  const vacantDays = total - occupied.size;
  if (vacantDays > 0 && slotPlan) warnings.push("vacant_slot_days");
  return { shares, vacantDays, ownerUserId: owner?.userId ?? null, warnings };
}
