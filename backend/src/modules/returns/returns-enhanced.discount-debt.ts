import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database";
import { parseAppliedBonusRulesSnapshot } from "../bonus-rules/bonus-rules.snapshot";
import { R } from "./returns-enhanced.helpers";

export const DISCOUNT_DEBT_MOVEMENT_NOTE = "Долг скидка";

export type DiscountClawbackMode = "none" | "proportional" | "full_revoke";

export type DiscountClawbackResult = {
  amount: Prisma.Decimal;
  new_discount_sum: Prisma.Decimal;
  mode: DiscountClawbackMode;
  discount_pct: number | null;
  min_sum: number | null;
  rule_name: string | null;
  order_id: number;
  order_number: string;
  remaining_gross: Prisma.Decimal;
  note: string;
};

function roundMoney(d: Prisma.Decimal): Prisma.Decimal {
  return d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function formatMoney(d: Prisma.Decimal): string {
  return roundMoney(d).toFixed(2);
}

/** Snapshotdan foizli skidka qoidasi (discount yoki sum+%). */
export function pickDiscountRuleFromSnapshot(raw: unknown): {
  name: string;
  type: string;
  min_sum: number | null;
  discount_pct: number | null;
} | null {
  const rules = parseAppliedBonusRulesSnapshot(raw);
  const hit = rules.find(
    (r) =>
      (r.type === "discount" || r.type === "sum") &&
      r.discount_pct != null &&
      Number(r.discount_pct) > 0
  );
  if (!hit) return null;
  return {
    name: hit.name,
    type: hit.type,
    min_sum: hit.type === "sum" && hit.min_sum != null ? Number(hit.min_sum) : null,
    discount_pct: hit.discount_pct != null ? Number(hit.discount_pct) : null
  };
}

/**
 * Qaytarishdan keyin qolgan pullik net bo‘yicha skidka.
 *
 * Refund allaqachon **net** (skidka narxda). Shuning uchun:
 * - foiz saqlansa (proportional) → balans qarzi **0**; faqat `discount_sum` yangilanadi
 * - min_sum buzilsa (full_revoke) → qolgan tovar uchun skidka olib tashlanadi:
 *   balans qarzi = qolgan gross × pct% (qaytarilgan qismning skidkasini qayta undirmaymiz)
 * - hammasi qaytarilsa → qarzi 0, `discount_sum` = 0
 */
export function computeDiscountClawback(input: {
  orderId: number;
  orderNumber: string;
  /** Qaytarishdan OLDIN qolgan pullik net (itemsAdjusted paid sum). */
  remainingPaidNetBefore: Prisma.Decimal | number | string;
  /** Shu hujjatdagi pullik refund (net). */
  thisReturnPaidNet: Prisma.Decimal | number | string;
  currentDiscountSum: Prisma.Decimal | number | string;
  discountPct: number | null;
  minSum: number | null;
  ruleName: string | null;
}): DiscountClawbackResult {
  const orderId = input.orderId;
  const orderNumber = String(input.orderNumber ?? "").trim() || String(orderId);
  const D = R(input.currentDiscountSum);
  const N0 = R(input.remainingPaidNetBefore);
  const retNet = R(input.thisReturnPaidNet);

  const empty = (mode: DiscountClawbackMode): DiscountClawbackResult => ({
    amount: new Prisma.Decimal(0),
    new_discount_sum: D.gt(0) ? D : new Prisma.Decimal(0),
    mode,
    discount_pct: input.discountPct,
    min_sum: input.minSum,
    rule_name: input.ruleName,
    order_id: orderId,
    order_number: orderNumber,
    remaining_gross: new Prisma.Decimal(0),
    note: ""
  });

  if (!D.gt(0)) return empty("none");

  const N1 = N0.sub(retNet);

  // Hammasi qaytarildi — refund net; skidka qarzi yo‘q
  if (!N0.gt(0) || !N1.gt(0)) {
    return {
      amount: new Prisma.Decimal(0),
      new_discount_sum: new Prisma.Decimal(0),
      mode: "full_revoke",
      discount_pct: input.discountPct,
      min_sum: input.minSum,
      rule_name: input.ruleName,
      order_id: orderId,
      order_number: orderNumber,
      remaining_gross: new Prisma.Decimal(0),
      note: ""
    };
  }

  let pct =
    input.discountPct != null && Number.isFinite(input.discountPct) && input.discountPct > 0
      ? input.discountPct
      : null;
  if (pct == null) {
    const g0 = N0.add(D);
    pct = g0.gt(0) ? Number(D.div(g0).mul(100).toDecimalPlaces(4)) : null;
  }
  if (pct == null || !(pct > 0) || pct >= 100) {
    // Foiz noma’lum — kitobiy proporsiya; balans qarzi yo‘q (refund net)
    const share = retNet.div(N0);
    const bookClaw = roundMoney(D.mul(share));
    const newD = roundMoney(D.sub(bookClaw));
    const remainingGross = roundMoney(N1.add(newD));
    return {
      amount: new Prisma.Decimal(0),
      new_discount_sum: newD.gt(0) ? newD : new Prisma.Decimal(0),
      mode: bookClaw.gt(0) ? "proportional" : "none",
      discount_pct: pct,
      min_sum: input.minSum,
      rule_name: input.ruleName,
      order_id: orderId,
      order_number: orderNumber,
      remaining_gross: remainingGross,
      note: ""
    };
  }

  const factor = new Prisma.Decimal(1).sub(new Prisma.Decimal(pct).div(100));
  const G1 = factor.gt(0) ? roundMoney(N1.div(factor)) : N1;
  const remainingDisc = roundMoney(G1.mul(pct).div(100));

  const minSum =
    input.minSum != null && Number.isFinite(input.minSum) && input.minSum > 0 ? input.minSum : null;

  if (minSum != null && G1.lt(minSum)) {
    // Shart buzildi: qolgan tovar to‘liq narxda — faqat qolgan skidkani undiramiz
    const note = remainingDisc.gt(0)
      ? buildDiscountDebtNote({
          orderNumber,
          amount: remainingDisc,
          mode: "full_revoke",
          discountPct: pct,
          minSum,
          ruleName: input.ruleName,
          remainingGross: G1
        })
      : "";
    return {
      amount: remainingDisc.gt(0) ? remainingDisc : new Prisma.Decimal(0),
      new_discount_sum: new Prisma.Decimal(0),
      mode: "full_revoke",
      discount_pct: pct,
      min_sum: minSum,
      rule_name: input.ruleName,
      order_id: orderId,
      order_number: orderNumber,
      remaining_gross: G1,
      note
    };
  }

  // Foiz saqlanadi — refund net, qo‘shimcha qarz yo‘q; discount_sum ni yangilaymiz
  const newD = remainingDisc;
  return {
    amount: new Prisma.Decimal(0),
    new_discount_sum: newD.gt(0) ? newD : new Prisma.Decimal(0),
    mode: D.gt(newD) ? "proportional" : "none",
    discount_pct: pct,
    min_sum: minSum,
    rule_name: input.ruleName,
    order_id: orderId,
    order_number: orderNumber,
    remaining_gross: G1,
    note: ""
  };
}

export function buildDiscountDebtNote(args: {
  orderNumber: string;
  amount: Prisma.Decimal;
  mode: DiscountClawbackMode;
  discountPct: number | null;
  minSum: number | null;
  ruleName: string | null;
  remainingGross: Prisma.Decimal;
  returnNumber?: string | null;
}): string {
  const parts: string[] = [DISCOUNT_DEBT_MOVEMENT_NOTE];
  const vr = args.returnNumber?.trim();
  if (vr) parts.push(vr);
  parts.push(`заказ #${args.orderNumber}`);
  if (args.ruleName?.trim()) parts.push(`«${args.ruleName.trim()}»`);
  if (args.discountPct != null && args.discountPct > 0) {
    parts.push(`${Math.round(args.discountPct * 100) / 100}%`);
  }
  if (args.minSum != null && args.minSum > 0) {
    parts.push(`мин. ${Math.round(args.minSum).toLocaleString("ru-RU")}`);
  }
  if (args.mode === "full_revoke") {
    parts.push("отозвано полностью");
    if (args.remainingGross.gt(0)) {
      parts.push(`остаток ${formatMoney(args.remainingGross)}`);
    }
  } else if (args.mode === "proportional") {
    parts.push("пропорционально");
  }
  parts.push(formatMoney(args.amount));
  return parts.join(" · ").slice(0, 500);
}

export function discountDebtNoteWithReturn(
  baseNote: string,
  returnNumber?: string | null
): string {
  const base = baseNote.trim();
  const vr = returnNumber?.trim();
  if (!base) {
    return vr ? `${DISCOUNT_DEBT_MOVEMENT_NOTE} · ${vr}` : DISCOUNT_DEBT_MOVEMENT_NOTE;
  }
  if (!vr) return base.slice(0, 500);
  if (base.startsWith(DISCOUNT_DEBT_MOVEMENT_NOTE)) {
    const rest = base.slice(DISCOUNT_DEBT_MOVEMENT_NOTE.length).replace(/^\s*·\s*/, "");
    return `${DISCOUNT_DEBT_MOVEMENT_NOTE} · ${vr}${rest ? ` · ${rest}` : ""}`.slice(0, 500);
  }
  return `${DISCOUNT_DEBT_MOVEMENT_NOTE} · ${vr} · ${base}`.slice(0, 500);
}

/** Po-zakaz: joriy skidka + qaytarilgan pullik net bo‘yicha clawback. */
export async function resolveOrderDiscountClawback(
  tenantId: number,
  orderId: number,
  thisReturnPaidNet: Prisma.Decimal | number | string,
  remainingPaidNetBefore: Prisma.Decimal | number | string
): Promise<DiscountClawbackResult | null> {
  if (!(orderId > 0)) return null;

  const order = await prismaOrder(tenantId, orderId);
  if (!order) return null;
  if (!order.discount_sum.gt(0)) return null;

  const rule = pickDiscountRuleFromSnapshot(order.applied_bonus_rules_snapshot);
  const result = computeDiscountClawback({
    orderId: order.id,
    orderNumber: order.number,
    remainingPaidNetBefore,
    thisReturnPaidNet,
    currentDiscountSum: order.discount_sum,
    discountPct: rule?.discount_pct ?? null,
    minSum: rule?.min_sum ?? null,
    ruleName: rule?.name ?? null
  });
  if (!result.amount.gt(0) && result.mode === "none") {
    return { ...result, amount: new Prisma.Decimal(0) };
  }
  return result;
}

async function prismaOrder(tenantId: number, orderId: number) {
  return prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId },
    select: {
      id: true,
      number: true,
      total_sum: true,
      discount_sum: true,
      applied_bonus_rules_snapshot: true
    }
  });
}

/** Pullik qatorlar net summasi (skidka allaqachon narxda). */
export function sumPaidNetFromItems(
  items: Array<{ is_bonus?: boolean; price: string | number; qty: string | number; total?: string | number }>
): Prisma.Decimal {
  let sum = new Prisma.Decimal(0);
  for (const it of items) {
    if (it.is_bonus) continue;
    if (it.total != null && String(it.total).trim() !== "") {
      const t = R(it.total);
      if (t.gt(0)) {
        sum = sum.add(t);
        continue;
      }
    }
    const q = Number(String(it.qty).replace(/\s/g, "").replace(",", "."));
    const p = Number(String(it.price).replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(q) || !Number.isFinite(p) || q <= 0) continue;
    sum = sum.add(R(p).mul(q));
  }
  return roundMoney(sum);
}

/** Qabulda: «Долг скидка» + zakaz `discount_sum` yangilash. */
export async function applyClientDiscountDebt(
  tx: PrismaClient | Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  amount: number | string | Prisma.Decimal,
  uid: number | null,
  opts: {
    returnNumber?: string | null;
    orderId?: number | null;
    note?: string | null;
    newDiscountSum?: Prisma.Decimal | number | string | null;
    paidAt?: Date;
  }
): Promise<void> {
  const debt = R(amount);
  if (!debt.gt(0)) return;

  const note = discountDebtNoteWithReturn(opts.note ?? "", opts.returnNumber);
  const delta = debt.negated();
  const eventAt = opts.paidAt ?? new Date();
  const orderId =
    opts.orderId != null && Number.isFinite(opts.orderId) && opts.orderId > 0 ? opts.orderId : null;

  await tx.payment.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      order_id: orderId,
      amount: debt,
      payment_type: "balance",
      note,
      created_by_user_id: uid,
      workflow_status: "confirmed",
      paid_at: eventAt,
      received_at: eventAt,
      confirmed_at: eventAt,
      entry_kind: "client_expense"
    }
  });

  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
    create: { tenant_id: tenantId, client_id: clientId, balance: delta },
    update: { balance: { increment: delta } }
  });
  await tx.clientBalanceMovement.create({
    data: {
      client_balance_id: bal.id,
      delta,
      note,
      user_id: uid
    }
  });

  if (orderId != null && opts.newDiscountSum != null) {
    const nd = R(opts.newDiscountSum);
    await tx.order.update({
      where: { id: orderId },
      data: { discount_sum: nd.gt(0) ? nd : new Prisma.Decimal(0) }
    });
  }
}
