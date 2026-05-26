import type { OrderItemRow } from "./order.types";

function parseDec(s: string): number {
  return Number.parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

function sumQty(rows: OrderItemRow[]): string {
  const n = rows.reduce((acc, r) => acc + parseDec(r.qty), 0);
  return String(n);
}

function mixedTriggerLabel(paidNames: string[]): string {
  const uniq = [...new Set(paidNames.map((n) => n.trim()).filter(Boolean))];
  if (uniq.length === 0) return "—";
  if (uniq.length === 1) return uniq[0]!;
  const head = uniq.slice(0, 3).join(", ");
  return uniq.length > 3 ? `Аралаш (${head}…)` : `Аралаш (${head})`;
}

/**
 * Pullik qatorlar uchun: qaysi bonus mahsulot berilgani va miqdori.
 * Bonus qatorlar uchun: qaysi mahsulot(lar) sabab bo‘lgani (аралаш — bir nechta trigger).
 */
export function enrichItemsBonusDisplay(mapped: OrderItemRow[]): OrderItemRow[] {
  const out = mapped.map((row) => ({
    ...row,
    bonus_product_name: null as string | null,
    bonus_product_qty: null as string | null,
    bonus_trigger_label: null as string | null
  }));

  const byId = new Map(out.map((r) => [r.id, r]));
  const paid = out.filter((r) => !r.is_bonus);
  const bonus = out.filter((r) => r.is_bonus);
  const allocated = new Set<number>();

  const assignToPaid = (
    paidId: number,
    gifts: OrderItemRow[],
    triggerLabel: string | null,
    mixed: boolean
  ) => {
    const row = byId.get(paidId);
    if (!row || gifts.length === 0) return;
    const names = gifts.map((g) => g.name).join(", ");
    row.bonus_product_name = mixed ? `${names} (Аралаш)` : names;
    row.bonus_product_qty = sumQty(gifts);
    row.bonus_trigger_label = triggerLabel;
  };

  for (const p of paid) {
    const mates = bonus.filter((b) => b.product_id === p.product_id && !allocated.has(b.id));
    if (mates.length === 0) continue;
    for (const m of mates) allocated.add(m.id);
    assignToPaid(p.id, mates, p.name, false);
  }

  const remaining = bonus.filter((b) => !allocated.has(b.id));
  if (remaining.length === 0) return out;

  const paidNames = paid.map((p) => p.name);
  const mixed = paidNames.length > 1;
  const trigger = mixed ? mixedTriggerLabel(paidNames) : paidNames[0] ?? null;

  for (const b of remaining) {
    const row = byId.get(b.id)!;
    row.bonus_product_name = b.name;
    row.bonus_product_qty = b.qty;
    row.bonus_trigger_label = trigger;
  }

  if (paid.length === 0) return out;

  if (mixed) {
    for (const p of paid) {
      const row = byId.get(p.id)!;
      if (row.bonus_product_name) continue;
      assignToPaid(p.id, remaining, trigger, true);
    }
  } else {
    const onlyPaid = paid[0]!;
    const row = byId.get(onlyPaid.id)!;
    if (!row.bonus_product_name) {
      assignToPaid(onlyPaid.id, remaining, onlyPaid.name, false);
    }
  }

  return out;
}
