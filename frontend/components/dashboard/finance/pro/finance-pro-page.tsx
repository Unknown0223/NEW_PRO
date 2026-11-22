"use client";

import "./finance-pro-theme.css";
import { formatFinanceProActiveDates } from "@/components/dashboard/finance/finance-ui-model";
import { FinanceProAccountsPayments } from "@/components/dashboard/finance/pro/finance-pro-accounts-payments";
import { FinanceProCashflowChart } from "@/components/dashboard/finance/pro/finance-pro-cashflow-chart";
import { FinanceProDetailsDialog } from "@/components/dashboard/finance/pro/finance-pro-details-dialog";
import { FinanceProExpenseDonut } from "@/components/dashboard/finance/pro/finance-pro-expense-donut";
import { FinanceProOperations } from "@/components/dashboard/finance/pro/finance-pro-operations";
import { detectFinanceProPeriod, periodKeyToDates } from "@/components/dashboard/finance/pro/finance-pro-periods";
import { downloadFinanceProCsv } from "@/components/dashboard/finance/pro/finance-pro-shared";
import { FinanceProSummaryCards } from "@/components/dashboard/finance/pro/finance-pro-summary-cards";
import type { FinanceProDetailView, FinanceProPeriodKey, FinanceProUiModel } from "@/components/dashboard/finance/pro/finance-pro-types";
import { BriefcaseBusiness, CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const PERIODS: FinanceProPeriodKey[] = ["Сегодня", "Вчера", "Неделя", "Месяц", "Квартал", "Год"];

export type FinanceProPageProps = {
  model: FinanceProUiModel;
  loading?: boolean;
  from: string;
  to: string;
  onPeriodChange: (from: string, to: string) => void;
};

export function FinanceProPage({ model, loading, from, to, onPeriodChange }: FinanceProPageProps) {
  const [detail, setDetail] = useState<FinanceProDetailView | null>(null);
  const [toast, setToast] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [customRange, setCustomRange] = useState({ start: from, end: to });
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Все операции");
  const activePanelRef = useRef<HTMLElement | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setCustomRange({ start: from, end: to });
  }, [from, to]);

  const activePeriod = useMemo(() => detectFinanceProPeriod(from, to), [from, to]);
  const activeDates = formatFinanceProActiveDates(from, to);

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };

  const openDetails = (view: FinanceProDetailView) => {
    setDateOpen(false);
    setDetail(view);
  };

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
      if (event.key === "Escape") {
        setDetail(null);
        setDateOpen(false);
      }
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

  const applyCustomRange = () => {
    if (!customRange.start || !customRange.end || customRange.start > customRange.end) {
      notify("Укажите корректный диапазон дат");
      return;
    }
    onPeriodChange(customRange.start, customRange.end);
    setDateOpen(false);
  };

  const exportTransactions = (rows: typeof model.recentTransactions) => {
    const dataRows: (string | number)[][] = [["Дата и время", "Тип", "Категория", "Описание", "Счёт", "Сумма", "Статус"]];
    rows.forEach((item) =>
      dataRows.push([item.date, item.type, item.category, item.description, item.account, item.amount, item.status])
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
        <div className="page-head">
          <div className="title-wrap">
            <div className="title-icon">
              <BriefcaseBusiness size={24} />
            </div>
            <div>
              <div className="eyebrow">УПРАВЛЕНИЕ БИЗНЕСОМ</div>
              <h1>Финансы</h1>
              <p>Контроль доходов, расходов и финансовых потоков вашей компании</p>
            </div>
          </div>
          <div className="filters">
            <div className="date-anchor">
              <button className="date-picker" onClick={() => setDateOpen((value) => !value)} aria-expanded={dateOpen} type="button">
                <CalendarDays size={18} />
                <span>{activeDates}</span>
                <ChevronDown size={16} />
              </button>
              {dateOpen ? (
                <div className="date-popover">
                  <div className="date-popover-heading">
                    <b>Выберите период</b>
                    <span>Финансовая аналитика</span>
                  </div>
                  <label>
                    Начало периода
                    <input
                      type="date"
                      value={customRange.start}
                      onChange={(event) => setCustomRange((current) => ({ ...current, start: event.target.value }))}
                    />
                  </label>
                  <label>
                    Конец периода
                    <input
                      type="date"
                      value={customRange.end}
                      onChange={(event) => setCustomRange((current) => ({ ...current, end: event.target.value }))}
                    />
                  </label>
                  <button className="primary-button apply-date" onClick={applyCustomRange} type="button">
                    Применить период
                  </button>
                </div>
              ) : null}
            </div>
            <div className="segmented">
              {PERIODS.map((item) => (
                <button
                  key={item}
                  className={activePeriod === item ? "selected" : ""}
                  onClick={() => {
                    const range = periodKeyToDates(item);
                    onPeriodChange(range.from, range.to);
                    setDateOpen(false);
                  }}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <FinanceProSummaryCards model={model} onOpenDetail={openDetails} />

        <div className="analytics-grid">
          <FinanceProCashflowChart points={model.cashflowByPeriod} onOpenDetail={openDetails} onExport={exportChart} />
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

      {loading ? <FinanceProLoadingCover /> : null}
    </div>
  );
}

function FinanceProLoadingCover() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        background: "rgba(246,249,253,0.55)",
        pointerEvents: "none"
      }}
    />
  );
}