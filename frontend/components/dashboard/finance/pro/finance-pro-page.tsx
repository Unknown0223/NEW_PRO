"use client";

import "./finance-pro-theme.css";
import { FinanceProAccountsPayments } from "@/components/dashboard/finance/pro/finance-pro-accounts-payments";
import { FinanceProCashflowChart } from "@/components/dashboard/finance/pro/finance-pro-cashflow-chart";
import { FinanceProDetailsDialog } from "@/components/dashboard/finance/pro/finance-pro-details-dialog";
import { FinanceProExpenseDonut } from "@/components/dashboard/finance/pro/finance-pro-expense-donut";
import { FinanceProOperations } from "@/components/dashboard/finance/pro/finance-pro-operations";
import { downloadFinanceProCsv } from "@/components/dashboard/finance/pro/finance-pro-shared";
import { FinanceProSummaryCards } from "@/components/dashboard/finance/pro/finance-pro-summary-cards";
import type { FinanceProDetailView, FinanceProUiModel } from "@/components/dashboard/finance/pro/finance-pro-types";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type FinanceProPageProps = {
  model: FinanceProUiModel;
  loading?: boolean;
  /** Dialog subtitle — period from FinanceFiltersBar. */
  activeDates: string;
};

/** Presentation-only: filters/title chrome lives in FinanceFiltersBar (single seam). */
export function FinanceProPage({ model, loading, activeDates }: FinanceProPageProps) {
  const [detail, setDetail] = useState<FinanceProDetailView | null>(null);
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Все операции");
  const activePanelRef = useRef<HTMLElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };

  const openDetails = (view: FinanceProDetailView) => setDetail(view);

  useEffect(() => {
    if (!detail) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detail]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    const shell = event.currentTarget;
    shell.style.setProperty("--pointer-x", `${event.clientX}px`);
    shell.style.setProperty("--pointer-y", `${event.clientY}px`);
    const target = event.target;
    const panel = target instanceof Element ? target.closest<HTMLElement>(".panel") : null;
    if (activePanelRef.current && activePanelRef.current !== panel) {
      activePanelRef.current.style.removeProperty("--spot-x");
      activePanelRef.current.style.removeProperty("--spot-y");
    }
    activePanelRef.current = panel;
    if (panel) {
      const bounds = panel.getBoundingClientRect();
      panel.style.setProperty("--spot-x", `${event.clientX - bounds.left}px`);
      panel.style.setProperty("--spot-y", `${event.clientY - bounds.top}px`);
    }
  };

  const handlePointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--pointer-x", "50vw");
    event.currentTarget.style.setProperty("--pointer-y", "32vh");
    activePanelRef.current?.style.removeProperty("--spot-x");
    activePanelRef.current?.style.removeProperty("--spot-y");
    activePanelRef.current = null;
  };

  const exportTransactions = (rows: typeof model.recentTransactions) => {
    const dataRows: (string | number)[][] = [
      ["Дата и время", "Тип", "Категория", "Описание", "Счёт", "Сумма", "Статус"]
    ];
    rows.forEach((item) =>
      dataRows.push([
        item.date,
        item.type,
        item.category,
        item.description,
        item.account,
        item.amount,
        item.status
      ])
    );
    downloadFinanceProCsv("finance-operacii.csv", dataRows);
    notify("Файл CSV подготовлен для Excel");
  };

  const exportChart = (rows: typeof model.cashflowByPeriod) => {
    downloadFinanceProCsv("finance-dinamika.csv", [
      ["Период", "Доход", "Расход", "Прибыль"],
      ...rows.map((item) => [item.label, item.income, item.expense, item.profit])
    ]);
    notify("Данные графика экспортированы");
  };

  return (
    <div
      className={`finance-pro${loading ? " finance-pro-loading" : ""}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <main className="finance-pro-main">
        <FinanceProSummaryCards model={model} onOpenDetail={openDetails} />

        <div className="analytics-grid">
          <FinanceProCashflowChart
            points={model.cashflowByPeriod}
            onOpenDetail={openDetails}
            onExport={exportChart}
          />
          <FinanceProExpenseDonut categories={model.expenseCategories} onOpenDetail={openDetails} />
        </div>

        <FinanceProOperations
          transactions={model.recentTransactions}
          incomeCategories={model.incomeCategories}
          expenseCategories={model.expenseCategories}
          onOpenDetail={openDetails}
          onExportTransactions={exportTransactions}
        />

        <FinanceProAccountsPayments
          accounts={model.accounts}
          payments={model.scheduledPayments}
          onOpenDetail={openDetails}
        />
      </main>

      {detail ? (
        <FinanceProDetailsDialog
          view={detail}
          activeDates={activeDates}
          model={{
            incomeCategories: model.incomeCategories,
            expenseCategories: model.expenseCategories,
            recentTransactions: model.recentTransactions,
            accounts: model.accounts,
            scheduledPayments: model.scheduledPayments,
            cashflowByPeriod: model.cashflowByPeriod,
            accountsBalance: model.accountsBalance
          }}
          search={search}
          filterType={filterType}
          onSearch={setSearch}
          onFilterType={setFilterType}
          onView={openDetails}
          onClose={() => setDetail(null)}
          onExportTransactions={() => exportTransactions(model.recentTransactions)}
          onExportChart={() => exportChart(model.cashflowByPeriod)}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <i>
            <Check size={16} />
          </i>
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Закрыть уведомление" type="button">
            <X size={15} />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            background: "rgba(246,249,253,0.55)",
            pointerEvents: "none"
          }}
        />
      ) : null}
    </div>
  );
}
