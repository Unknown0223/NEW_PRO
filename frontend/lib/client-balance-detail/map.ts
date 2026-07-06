import type { ClientBalanceLedgerResponse, ClientLedgerRow } from "@/lib/client-balance-ledger-types";
import type { BalanceDetailCard, BalanceDetailCustomer, BalanceDetailRow } from "./types";
import { parseLedgerKpiAmount, resolveCardPaymentSubLines } from "@/lib/ledger-kpi-payment-triple";

function paymentMethodLabel(r: ClientLedgerRow): string {
  const pay = (r.payment_type ?? "").trim();
  const ord = (r.order_payment_method_label ?? "").trim();
  if (r.row_kind === "payment" && ord && pay && pay !== ord) return `${pay} · заказ: ${ord}`;
  return pay || ord;
}

export function mapCustomer(data: ClientBalanceLedgerResponse): BalanceDetailCustomer {
  const c = data.client;
  const code = c.client_code?.trim();
  return {
    id: c.id,
    name: code ? `${code} ${c.name}` : c.name,
    phone: c.phone?.trim() ?? "",
    territory: c.territory_label?.trim() ?? "—"
  };
}

function parseAmount(s: string | null | undefined): number {
  return parseLedgerKpiAmount(s);
}

function cardFromPaymentTypes(
  id: string,
  title: string,
  amount: number,
  paymentByType: { label: string; amount: string }[],
  agentId: number | null
): BalanceDetailCard {
  const paymentSubLines = resolveCardPaymentSubLines(paymentByType);
  let cash = 0;
  let transfer = 0;
  let terminal = 0;
  for (const line of paymentSubLines) {
    const t = line.label.toLowerCase();
    if (t.includes("naqd") || t.includes("налич") || t.includes("cash") || t.includes("нал")) cash += line.amount;
    else if (t.includes("perech") || t.includes("переч") || t.includes("transfer")) transfer += line.amount;
    else if (t.includes("terminal") || t.includes("термин") || t.includes("пласт") || t.includes("карт"))
      terminal += line.amount;
  }
  return { id, title, amount, oldDebtIncome: 0, cash, transfer, terminal, paymentSubLines, agentId };
}

export function mapBalanceCards(
  data: ClientBalanceLedgerResponse,
  showGeneral: boolean
): BalanceDetailCard[] {
  const cards: BalanceDetailCard[] = [];
  if (showGeneral) {
    cards.push(
      cardFromPaymentTypes(
        "main",
        "Общий",
        parseAmount(data.ledger_net_balance ?? data.account_balance),
        data.summary_payment_by_type,
        null
      )
    );
  }
  for (const ac of data.agent_cards) {
    const gd = parseAmount(ac.ledger_general_debt_total);
    const gp = parseAmount(ac.ledger_general_payment_total);
    const title = ac.agent_code ? `${ac.agent_name} (${ac.agent_code})` : ac.agent_name;
    cards.push(cardFromPaymentTypes(String(ac.agent_id ?? "null"), title, gp - gd, ac.payment_by_type, ac.agent_id));
  }
  return cards;
}

export function mapLedgerRow(r: ClientLedgerRow, tab: "overall" | "detailed"): BalanceDetailRow {
  const debtRaw = parseAmount(r.debt_amount);
  const payRaw = parseAmount(r.payment_amount);
  const debt = tab === "overall" ? (debtRaw !== 0 ? Math.abs(debtRaw) : 0) : debtRaw;
  const payment = tab === "overall" ? (payRaw > 0 ? payRaw : 0) : payRaw;

  return {
    key: `${r.row_kind}-${r.order_id ?? ""}-${r.payment_id ?? ""}-${r.sort_at}`,
    raw: r,
    createdAt: r.sort_at,
    typeLabel: r.type_label,
    docNumber: r.order_number ?? String(r.payment_id ?? r.order_id ?? ""),
    operationName: r.operation_type_code,
    orderType: r.order_kind_label ?? (r.row_kind === "payment" ? "Оплата" : "Заказ"),
    consignment: r.is_consignment === true,
    debt,
    payment,
    balanceAfter: r.balance_after != null ? parseAmount(r.balance_after) : null,
    paymentMethod: paymentMethodLabel(r),
    agent: r.agent_name?.trim() ?? "",
    expeditor: r.expeditor_name?.trim() ?? "",
    cashbox: r.cash_desk_name?.trim() ?? "",
    comment: r.note?.trim() ?? r.comment_primary?.trim() ?? "",
    txComment: r.comment_transaction?.trim() ?? "",
    createdBy: r.created_by_display?.trim() ?? r.created_by_login?.trim() ?? "",
    isSystem: r.entry_kind === "client_expense" || r.operation_type_code === "2"
  };
}

export function ledgerTotalsFromRows(rows: BalanceDetailRow[]) {
  let debt = 0;
  let payment = 0;
  for (const r of rows) {
    if (r.debt !== 0) debt -= Math.abs(r.debt);
    if (r.payment > 0) payment += r.payment;
  }
  return { debt, payment, net: debt + payment };
}

export function filterOptionsFromRows(rows: ClientLedgerRow[]) {
  const agents = new Set<string>();
  const expeditors = new Set<string>();
  const cashboxes = new Set<string>();
  const creators = new Set<string>();
  for (const r of rows) {
    if (r.agent_name?.trim()) agents.add(r.agent_name.trim());
    if (r.expeditor_name?.trim()) expeditors.add(r.expeditor_name.trim());
    if (r.cash_desk_name?.trim()) cashboxes.add(r.cash_desk_name.trim());
    const cb = r.created_by_display?.trim() || r.created_by_login?.trim();
    if (cb) creators.add(cb);
  }
  return {
    agents: [...agents].sort(),
    expeditors: [...expeditors].sort(),
    cashboxes: [...cashboxes].sort(),
    creators: [...creators].sort()
  };
}
