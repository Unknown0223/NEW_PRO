"use client";

import { downloadFinanceProCsv } from "@/components/dashboard/finance/pro/finance-pro-shared";
import {
  DetailAccountBody,
  DetailAccountsBody,
  DetailCategoryBody,
  DetailChartBody,
  DetailPaymentsBody,
  DetailTransactionsBody
} from "@/components/dashboard/finance/pro/finance-pro-detail-views";
import type {
  FinanceProAccount,
  FinanceProCategoryItem,
  FinanceProChartPoint,
  FinanceProDetailView,
  FinanceProScheduledPayment,
  FinanceProTransaction
} from "@/components/dashboard/finance/pro/finance-pro-types";
import { ArrowLeft, CalendarClock, ChartNoAxesCombined, ClipboardList, Download, WalletCards, X } from "lucide-react";
import { useEffect, useRef, type RefObject } from "react";

export type FinanceProDetailsDialogProps = {
  view: FinanceProDetailView;
  activeDates: string;
  model: {
    incomeCategories: FinanceProCategoryItem[];
    expenseCategories: FinanceProCategoryItem[];
    recentTransactions: FinanceProTransaction[];
    accounts: FinanceProAccount[];
    scheduledPayments: FinanceProScheduledPayment[];
    cashflowByPeriod: FinanceProChartPoint[];
    accountsBalance: number;
  };
  search: string;
  filterType: string;
  onSearch: (value: string) => void;
  onFilterType: (value: string) => void;
  onView: (view: FinanceProDetailView) => void;
  onClose: () => void;
  onExportTransactions: () => void;
  onExportChart: () => void;
};

function useDialogFocus(modalRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => modalRef.current?.querySelector<HTMLElement>(".detail-close")?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [modalRef]);
}

export function FinanceProDetailsDialog(props: FinanceProDetailsDialogProps) {
  const {
    view,
    activeDates,
    model,
    search,
    filterType,
    onSearch,
    onFilterType,
    onView,
    onClose,
    onExportTransactions,
    onExportChart
  } = props;
  const modalRef = useRef<HTMLElement>(null);
  useDialogFocus(modalRef);

  const account = model.accounts.find((item) => item.name === (view.kind === "account" ? view.accountName : ""));
  const accountTransactions = account
    ? model.recentTransactions.filter((item) => item.account.split(" → ").includes(account.name))
    : [];

  const filteredTransactions = model.recentTransactions.filter((transaction) => {
    const matchesQuery = `${transaction.date} ${transaction.type} ${transaction.description} ${transaction.account} ${transaction.category}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesType = filterType === "Все операции" || transaction.type === filterType;
    return matchesQuery && matchesType;
  });

  const isCategoryView = view.kind === "income" || view.kind === "expense" || view.kind === "breakdown";
  const categoryItems = view.kind === "income" ? model.incomeCategories : model.expenseCategories;
  const categoryTotal = categoryItems.reduce((sum, item) => sum + item.amount, 0);
  const pendingPayments = model.scheduledPayments.filter((item) => item.status === "Ожидает");
  const pendingTotal = pendingPayments.reduce((sum, item) => sum + item.amount, 0);

  const title =
    view.kind === "transactions"
      ? "Все операции"
      : view.kind === "income"
        ? "Категории доходов"
        : view.kind === "expense"
          ? "Категории расходов"
          : view.kind === "breakdown"
            ? "Распределение расходов"
            : view.kind === "accounts"
              ? "Счета и кошельки"
              : view.kind === "account"
                ? `Счёт «${account?.name || ""}»`
                : view.kind === "payments"
                  ? "Платёжный календарь"
                  : "Динамика финансов";

  const subtitle =
    view.kind === "payments"
      ? "План платежей и контроль предстоящих расходов"
      : view.kind === "accounts" || view.kind === "account"
        ? "Доступные средства и движение по счетам"
        : view.kind === "transactions"
          ? "Полная история операций с категориями и счетами"
          : `Данные за период: ${activeDates}`;

  const headerIcon =
    view.kind === "payments" ? (
      <CalendarClock size={21} />
    ) : view.kind === "accounts" || view.kind === "account" ? (
      <WalletCards size={21} />
    ) : view.kind === "transactions" ? (
      <ClipboardList size={21} />
    ) : (
      <ChartNoAxesCombined size={21} />
    );

  return (
    <div className="modal-backdrop detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={modalRef} className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="finance-pro-detail-title">
        <header className="detail-header">
          <div className="detail-header-icon">{headerIcon}</div>
          <div className="detail-heading">
            {view.kind === "account" ? (
              <button className="detail-back" onClick={() => onView({ kind: "accounts" })} type="button">
                <ArrowLeft size={13} /> Все счета
              </button>
            ) : (
              <span className="detail-eyebrow">ФИНАНСЫ</span>
            )}
            <h2 id="finance-pro-detail-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-action detail-close" onClick={onClose} aria-label="Закрыть окно" type="button">
            <X size={19} />
          </button>
        </header>

        <div className="detail-body" key={`${view.kind}-${view.kind === "account" ? view.accountName : ""}`}>
          {isCategoryView ? (
            <DetailCategoryBody viewKind={view.kind} categoryItems={categoryItems} categoryTotal={categoryTotal} />
          ) : null}
          {view.kind === "transactions" ? (
            <DetailTransactionsBody
              search={search}
              filterType={filterType}
              filteredTransactions={filteredTransactions}
              onSearch={onSearch}
              onFilterType={onFilterType}
            />
          ) : null}
          {view.kind === "accounts" ? (
            <DetailAccountsBody
              accounts={model.accounts}
              accountsBalance={model.accountsBalance}
              onPickAccount={(name) => onView({ kind: "account", accountName: name })}
            />
          ) : null}
          {view.kind === "account" && account ? (
            <DetailAccountBody account={account} accountTransactions={accountTransactions} />
          ) : null}
          {view.kind === "payments" ? (
            <DetailPaymentsBody
              scheduledPayments={model.scheduledPayments}
              pendingPayments={pendingPayments}
              pendingTotal={pendingTotal}
            />
          ) : null}
          {view.kind === "chart" ? <DetailChartBody chartData={model.cashflowByPeriod} /> : null}
        </div>

        <footer className="detail-footer">
          <span>
            {view.kind === "payments" || view.kind === "accounts" || view.kind === "account"
              ? "Данные доступны только для просмотра"
              : view.kind === "transactions"
                ? "Показаны все подходящие операции"
                : `Период: ${activeDates}`}
          </span>
          <div>
            {isCategoryView ? (
              <button
                className="secondary-button detail-footer-button"
                onClick={() =>
                  downloadFinanceProCsv("finance-kategorii.csv", [
                    ["Категория", "Сумма", "Доля, %"],
                    ...categoryItems.map((item) => [item.name, Math.round(item.amount), item.pct.toFixed(1)])
                  ])
                }
                type="button"
              >
                <Download size={14} /> Экспорт
              </button>
            ) : null}
            {view.kind === "transactions" ? (
              <button className="secondary-button detail-footer-button" onClick={onExportTransactions} type="button">
                <Download size={14} /> Экспорт
              </button>
            ) : null}
            {view.kind === "chart" ? (
              <button className="secondary-button detail-footer-button" onClick={onExportChart} type="button">
                <Download size={14} /> Скачать данные
              </button>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}