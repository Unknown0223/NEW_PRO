"use client";

import { FinanceProPanel } from "@/components/dashboard/finance/pro/finance-pro-shared";
import { formatCurrency } from "@/components/dashboard/finance/pro/finance-pro-format";
import type {
  FinanceProCategoryItem,
  FinanceProDetailView,
  FinanceProTransaction
} from "@/components/dashboard/finance/pro/finance-pro-types";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  Download,
  Gift,
  Package,
  ShoppingBag,
  Users
} from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  transactions: FinanceProTransaction[];
  incomeCategories: FinanceProCategoryItem[];
  expenseCategories: FinanceProCategoryItem[];
  onOpenDetail: (view: FinanceProDetailView) => void;
  onExportTransactions: (rows: FinanceProTransaction[]) => void;
};

function TransactionRow({ transaction }: { transaction: FinanceProTransaction }) {
  const isIncome = transaction.type === "Доход";
  const isTransfer = transaction.type === "Перевод";
  return (
    <div className="op-row">
      <i className={isIncome ? "in" : isTransfer ? "transfer" : "out"}>
        {isIncome ? <ArrowDownLeft size={15} /> : isTransfer ? <ArrowLeftRight size={14} /> : <ArrowUpRight size={15} />}
      </i>
      <span className="op-date">{transaction.date}</span>
      <span>
        <b className={isIncome ? "type-in" : isTransfer ? "type-transfer" : "type-out"}>{transaction.type}</b>
      </span>
      <span className="op-description" title={transaction.description}>
        {transaction.description}
      </span>
      <strong className={isIncome ? "positive" : isTransfer ? "neutral" : "negative"}>
        {isIncome ? "+" : isTransfer ? "↔" : "−"} {formatCurrency(transaction.amount)}
      </strong>
      <span>
        <em className={transaction.status === "Завершено" ? "complete" : "pending"}>{transaction.status}</em>
      </span>
    </div>
  );
}

function CategoryPanel({
  title,
  items,
  kind,
  onAll
}: {
  title: string;
  items: FinanceProCategoryItem[];
  kind: "income" | "expense";
  onAll: () => void;
}) {
  return (
    <FinanceProPanel className="categories">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>По сумме за выбранный период</p>
        </div>
        <button className="text-link" onClick={onAll} type="button">
          Все <ArrowUpRight size={13} />
        </button>
      </div>
      {items.map((item, index) => (
        <div className="category" key={item.name}>
          <i style={{ background: `${item.color}1e`, color: item.color }}>
            {kind === "income" ? (
              index === 0 ? (
                <ShoppingBag size={15} />
              ) : index === 1 ? (
                <ChartNoAxesCombined size={15} />
              ) : (
                <Gift size={15} />
              )
            ) : index === 0 ? (
              <Package size={15} />
            ) : index === 1 ? (
              <Users size={15} />
            ) : (
              <Building2 size={15} />
            )}
          </i>
          <div>
            <span>
              <b>{item.name}</b>
              <small>
                {formatCurrency(item.amount)} <em>{item.pct.toFixed(1)}%</em>
              </small>
            </span>
            <div className="progress">
              <em style={{ background: item.color, width: `${item.pct}%` }} />
            </div>
          </div>
        </div>
      ))}
    </FinanceProPanel>
  );
}

export function FinanceProOperations({
  transactions,
  incomeCategories,
  expenseCategories,
  onOpenDetail,
  onExportTransactions
}: Props) {
  const [filterType, setFilterType] = useState("Все операции");

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const matchesType = filterType === "Все операции" || transaction.type === filterType;
        return matchesType;
      }),
    [transactions, filterType]
  );

  const topIncome = useMemo(
    () => [...incomeCategories].sort((a, b) => b.amount - a.amount).slice(0, 4),
    [incomeCategories]
  );
  const topExpense = useMemo(
    () => [...expenseCategories].sort((a, b) => b.amount - a.amount).slice(0, 4),
    [expenseCategories]
  );

  return (
    <div className="details-grid">
      <FinanceProPanel className="operations">
        <div className="panel-head operation-head">
          <div>
            <h2>Последние операции</h2>
            <p>Всего записей: {filteredTransactions.length} · Только просмотр</p>
          </div>
          <div className="operation-tools">
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              aria-label="Фильтр типа операций"
            >
              <option>Все операции</option>
              <option>Доход</option>
              <option>Расход</option>
              <option>Перевод</option>
            </select>
            <button
              className="icon-action export-action"
              onClick={() => onExportTransactions(filteredTransactions)}
              title="Экспортировать операции"
              aria-label="Экспортировать операции"
              type="button"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <div className="table-head">
            <span>Дата и время</span>
            <span>Тип</span>
            <span>Описание</span>
            <span>Сумма</span>
            <span>Статус</span>
          </div>
          {filteredTransactions.slice(0, 5).map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
          {filteredTransactions.length === 0 ? (
            <div className="empty">Операции не найдены. Измените поиск или фильтр.</div>
          ) : null}
        </div>
        <button className="show-more" onClick={() => onOpenDetail({ kind: "transactions" })} type="button">
          Все операции <ArrowRight size={13} />
        </button>
      </FinanceProPanel>
      <CategoryPanel
        title="Топ категорий доходов"
        items={topIncome}
        kind="income"
        onAll={() => onOpenDetail({ kind: "income" })}
      />
      <CategoryPanel
        title="Топ категорий расходов"
        items={topExpense}
        kind="expense"
        onAll={() => onOpenDetail({ kind: "expense" })}
      />
    </div>
  );
}