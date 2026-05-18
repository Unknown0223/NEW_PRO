import { Prisma } from "@prisma/client";
import { agentInclude } from "./client-balances.constants";
import {
  mergeLedgerWithUnpaidDelivered,
  type DeliveryDebtInfo,
  type UnpaidDeliveredOrderRow
} from "./client-balances.delivery";
import { paymentAmountsForOrderDebtByMethod } from "./client-balances.payments.util";
import type { ClientBalancePaymentTypeSummary, ClientBalanceRow } from "./client-balances.types";
import {
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

export function mapClientRow(
  c: {
    id: number;
    name: string;
    is_active: boolean;
    legal_name: string | null;
    client_code: string | null;
    inn: string | null;
    phone: string | null;
    license_until: Date | null;
    agent: Prisma.UserGetPayload<{ select: (typeof agentInclude)["select"] }> | null;
    client_balances: { balance: Prisma.Decimal }[];
  },
  paymentAmounts: ClientBalancePaymentTypeSummary[],
  lastPay: Date | undefined,
  lastOrd: Date | undefined,
  balanceOverride: Prisma.Decimal | null,
  deliveryOverride: DeliveryDebtInfo | null,
  /** «По клиентам»: yetkazilgan, lekin zakaz bo‘yicha to‘lanmagan — balans ustiga */
  unpaidDeliveredBlend?: DeliveryDebtInfo | null
): ClientBalanceRow {
  const ledgerBal = c.client_balances[0]?.balance ?? new Prisma.Decimal(0);
  let bal: Prisma.Decimal;
  if (deliveryOverride) {
    bal = deliveryOverride.debt.neg();
  } else {
    const base = balanceOverride ?? ledgerBal;
    bal = mergeLedgerWithUnpaidDelivered(base, unpaidDeliveredBlend ?? undefined);
  }
  const balStr = bal.toString();

  const ag = c.agent;
  const td =
    (ag?.trade_direction && String(ag.trade_direction).trim()) ||
    ag?.trade_direction_row?.name?.trim() ||
    null;

  let daysOver: number | null = null;
  if (deliveryOverride) {
    if (deliveryOverride.firstDel) {
      daysOver = Math.floor((Date.now() - deliveryOverride.firstDel.getTime()) / 86400000);
    }
  } else if (
    unpaidDeliveredBlend &&
    unpaidDeliveredBlend.debt.gt(0) &&
    unpaidDeliveredBlend.firstDel
  ) {
    daysOver = Math.floor((Date.now() - unpaidDeliveredBlend.firstDel.getTime()) / 86400000);
  } else if (c.license_until) {
    const diff = Date.now() - c.license_until.getTime();
    if (diff > 0) daysOver = Math.floor(diff / 86400000);
  }

  let daysSincePay: number | null = null;
  if (lastPay) {
    daysSincePay = Math.floor((Date.now() - lastPay.getTime()) / 86400000);
  }

  const tags: string[] = [];
  if (ag?.name) tags.push(ag.code ? `${ag.name} (${ag.code})` : ag.name);

  const lastOrdOut =
    deliveryOverride?.lastDel != null
      ? deliveryOverride.lastDel
      : unpaidDeliveredBlend && unpaidDeliveredBlend.debt.gt(0) && unpaidDeliveredBlend.lastDel != null
        ? unpaidDeliveredBlend.lastDel
        : lastOrd;

  return {
    client_id: c.id,
    client_code: c.client_code,
    name: c.name,
    is_active: c.is_active,
    legal_name: c.legal_name,
    agent_id: ag?.id ?? null,
    agent_name: ag?.name ?? null,
    agent_code: ag?.code ?? null,
    agent_tags: tags,
    supervisor_name: ag?.supervisor?.name ?? null,
    trade_direction: td,
    inn: c.inn,
    phone: c.phone,
    license_until: c.license_until?.toISOString() ?? null,
    days_overdue: daysOver,
    last_order_at: lastOrdOut?.toISOString() ?? null,
    last_payment_at: lastPay?.toISOString() ?? null,
    days_since_payment: daysSincePay,
    balance: balStr,
    payment_amounts: paymentAmounts
  };
}

export function mapDeliveryOrderRow(
  c: {
    id: number;
    name: string;
    is_active: boolean;
    legal_name: string | null;
    client_code: string | null;
    inn: string | null;
    phone: string | null;
    license_until: Date | null;
    agent: Prisma.UserGetPayload<{ select: (typeof agentInclude)["select"] }> | null;
    client_balances: { balance: Prisma.Decimal }[];
  },
  od: UnpaidDeliveredOrderRow,
  sprLabels: string[],
  paymentMethodEntries: PaymentMethodEntryDto[],
  lastPay: Date | undefined
): ClientBalanceRow {
  const ag = c.agent;
  const td =
    (ag?.trade_direction && String(ag.trade_direction).trim()) ||
    ag?.trade_direction_row?.name?.trim() ||
    null;
  const tags: string[] = [];
  if (ag?.name) tags.push(ag.code ? `${ag.name} (${ag.code})` : ag.name);

  let daysOver: number | null = null;
  if (od.delivered_at) {
    daysOver = Math.floor((Date.now() - od.delivered_at.getTime()) / 86400000);
  }
  let daysSincePay: number | null = null;
  if (lastPay) {
    daysSincePay = Math.floor((Date.now() - lastPay.getTime()) / 86400000);
  }

  return {
    client_id: c.id,
    client_code: c.client_code,
    name: c.name,
    is_active: c.is_active,
    legal_name: c.legal_name,
    agent_id: ag?.id ?? null,
    agent_name: ag?.name ?? null,
    agent_code: ag?.code ?? null,
    agent_tags: tags,
    supervisor_name: ag?.supervisor?.name ?? null,
    trade_direction: td,
    inn: c.inn,
    phone: c.phone,
    license_until: c.license_until?.toISOString() ?? null,
    days_overdue: daysOver,
    last_order_at: od.delivered_at?.toISOString() ?? null,
    last_payment_at: lastPay?.toISOString() ?? null,
    days_since_payment: daysSincePay,
    balance: od.unpaid.neg().toString(),
    payment_amounts: paymentAmountsForOrderDebtByMethod(
      sprLabels,
      paymentMethodEntries,
      od.payment_method_ref,
      od.unpaid
    ),
    delivery_order_id: od.order_id,
    delivery_order_number: od.order_number,
    order_id: od.order_id
  };
}
