"use client";

import { FinanceProPanel } from "@/components/dashboard/finance/pro/finance-pro-shared";
import {
  formatCurrency,
  formatIsoToDot,
  localDateYmd,
  paymentDateParts
} from "@/components/dashboard/finance/pro/finance-pro-format";
import type {
  FinanceProAccount,
  FinanceProDetailView,
  FinanceProScheduledPayment
} from "@/components/dashboard/finance/pro/finance-pro-types";
import { ArrowRight, ArrowUpRight, Building2, CalendarClock, CircleDollarSign, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Props = {
  accounts: FinanceProAccount[];
  payments: FinanceProScheduledPayment[];
  onOpenDetail: (view: FinanceProDetailView) => void;
};

function pickAccountIcon(name: string, type: string): LucideIcon {
  const haystack = `${name} ${type}`.toLowerCase();
  if (haystack.includes("налич") || haystack.includes("касс")) return CircleDollarSign;
  if (haystack.includes("банк") || haystack.includes("терминал") || haystack.includes("перевод")) {
    return WalletCards;
  }
  return Building2;
}

export function FinanceProAccountsPayments({ accounts, payments, onOpenDetail }: Props) {
  const sortedPayments = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  const pendingPayments = sortedPayments.filter((payment) => payment.status === "Ожидает");
  const today = localDateYmd();

  return (
    <div className="bottom-grid">
      <FinanceProPanel className="accounts">
        <div className="panel-head">
          <div>
            <h2>Счета и кошельки</h2>
            <p>Доступные средства компании</p>
          </div>
          <button className="text-link" onClick={() => onOpenDetail({ kind: "accounts" })} type="button">
            Все счета <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="account-list">
          {accounts.map((account) => {
            const Icon = pickAccountIcon(account.name, account.type);
            return (
              <button
                key={account.id}
                onClick={() => onOpenDetail({ kind: "account", accountName: account.name })}
                type="button"
              >
                <i style={{ background: `${account.color}18`, color: account.color }}>
                  <Icon size={18} />
                </i>
                <span>
                  <small>{account.name}</small>
                  <b>{formatCurrency(account.amount)}</b>
                  <em>{account.type}</em>
                </span>
                <ArrowUpRight className="account-arrow" size={13} />
              </button>
            );
          })}
        </div>
      </FinanceProPanel>
      <FinanceProPanel className="payments-overview">
        <div className="panel-head payment-head">
          <div>
            <h2>Ближайшие платежи</h2>
            <p>Запланировано: {pendingPayments.length}</p>
          </div>
          <button className="text-link" onClick={() => onOpenDetail({ kind: "payments" })} type="button">
            Все платежи <ArrowUpRight size={13} />
          </button>
        </div>
        <div className="payment-preview">
          {pendingPayments.slice(0, 3).map((payment) => {
            const date = paymentDateParts(payment.date);
            const overdue = payment.date < today;
            return (
              <button
                className="payment-preview-row"
                key={payment.id}
                onClick={() => onOpenDetail({ kind: "payments" })}
                type="button"
              >
                <span className="payment-date">
                  <b>{date.day}</b>
                  <small>{date.month}</small>
                </span>
                <span className="payment-preview-name">
                  <b>{payment.name}</b>
                  <small>
                    {payment.category} · {payment.account}
                  </small>
                </span>
                <span className="payment-preview-amount">
                  <b>{formatCurrency(payment.amount)}</b>
                  <small className={overdue ? "overdue" : ""}>{overdue ? "Просрочено" : "Ожидает"}</small>
                </span>
                <ArrowRight size={13} className="payment-row-arrow" />
              </button>
            );
          })}
          {pendingPayments.length === 0 ? (
            <div className="payment-empty">
              <CalendarClock size={19} />
              <span>Все платежи оплачены. Новых платежей пока нет.</span>
            </div>
          ) : null}
        </div>
      </FinanceProPanel>
    </div>
  );
}

export function formatPaymentExportDate(iso: string): string {
  return formatIsoToDot(iso);
}