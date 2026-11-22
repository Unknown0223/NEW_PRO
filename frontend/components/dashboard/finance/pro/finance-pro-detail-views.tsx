"use client";

import {
  compactCurrency,
  formatCurrency,
  formatIsoToDot,
  localDateYmd,
  paymentDateParts
} from "@/components/dashboard/finance/pro/finance-pro-format";
import type {
  FinanceProAccount,
  FinanceProCategoryItem,
  FinanceProChartPoint,
  FinanceProScheduledPayment,
  FinanceProTransaction
} from "@/components/dashboard/finance/pro/finance-pro-types";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Search,
  WalletCards,
  X
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

export function DetailTransactionList({
  items,
  emptyMessage = "Операции не найдены. Измените поиск или фильтр."
}: {
  items: FinanceProTransaction[];
  emptyMessage?: string;
}) {
  if (items.length === 0) return <div className="detail-empty">{emptyMessage}</div>;
  return (
    <div className="detail-transaction-list">
      {items.map((transaction) => {
        const isIncome = transaction.type === "Доход";
        const isTransfer = transaction.type === "Перевод";
        return (
          <div className="detail-transaction-row" key={transaction.id}>
            <i className={isIncome ? "in" : isTransfer ? "transfer" : "out"}>
              {isIncome ? <ArrowDownLeft size={16} /> : isTransfer ? <ArrowLeftRight size={15} /> : <ArrowUpRight size={16} />}
            </i>
            <div className="detail-transaction-name">
              <b>{transaction.description}</b>
              <small>
                {transaction.category} · {transaction.account}
              </small>
            </div>
            <span className="detail-transaction-date">{transaction.date}</span>
            <span className={`detail-type ${isIncome ? "type-in" : isTransfer ? "type-transfer" : "type-out"}`}>
              {transaction.type}
            </span>
            <div className="detail-transaction-value">
              <strong className={isIncome ? "positive" : isTransfer ? "neutral" : "negative"}>
                {isIncome ? "+" : isTransfer ? "↔" : "−"} {formatCurrency(transaction.amount)}
              </strong>
              <small className={transaction.status === "Завершено" ? "" : "waiting"}>{transaction.status}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DetailCategoryBody({
  viewKind,
  categoryItems,
  categoryTotal
}: {
  viewKind: "income" | "expense" | "breakdown";
  categoryItems: FinanceProCategoryItem[];
  categoryTotal: number;
}) {
  return (
    <>
      {viewKind === "breakdown" ? (
        <div className="detail-breakdown-summary">
          <div className="detail-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryItems} dataKey="amount" innerRadius="70%" outerRadius="96%" startAngle={90} endAngle={-270} paddingAngle={1.3} stroke="none">
                  {categoryItems.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div>
              <strong>{categoryItems.length}</strong>
              <span>категорий</span>
            </div>
          </div>
          <div className="detail-breakdown-copy">
            <small>ВСЕГО РАСХОДОВ</small>
            <strong>{formatCurrency(categoryTotal)}</strong>
            <p>Полная структура затрат за выбранный период</p>
          </div>
        </div>
      ) : (
        <div className="detail-total">
          <div>
            <span>{viewKind === "income" ? "Общий доход" : "Общие расходы"}</span>
            <strong>{formatCurrency(categoryTotal)}</strong>
            <small>За выбранный период</small>
          </div>
          <div className="detail-total-side">
            <b>{categoryItems.length}</b>
            <span>категорий</span>
          </div>
        </div>
      )}
      <div className="detail-section-heading">
        <h3>Все категории</h3>
        <span>Сумма и доля</span>
      </div>
      <div className="detail-category-list">
        {[...categoryItems].sort((a, b) => b.amount - a.amount).map((item) => (
          <div className="detail-category-row" key={item.name}>
            <i style={{ background: item.color }} />
            <div className="detail-category-name">
              <b>{item.name}</b>
              <div className="detail-progress">
                <span style={{ background: item.color, width: `${item.pct}%` }} />
              </div>
            </div>
            <strong>{formatCurrency(item.amount)}</strong>
            <span className="detail-percentage">{item.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function DetailTransactionsBody({
  search,
  filterType,
  filteredTransactions,
  onSearch,
  onFilterType
}: {
  search: string;
  filterType: string;
  filteredTransactions: FinanceProTransaction[];
  onSearch: (value: string) => void;
  onFilterType: (value: string) => void;
}) {
  return (
    <>
      <div className="detail-toolbar">
        <label className="detail-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Поиск по операциям, счетам и категориям"
            aria-label="Поиск операций"
          />
          {search ? (
            <button onClick={() => onSearch("")} aria-label="Очистить поиск" type="button">
              <X size={14} />
            </button>
          ) : null}
        </label>
        <select value={filterType} onChange={(event) => onFilterType(event.target.value)} aria-label="Тип операций">
          <option>Все операции</option>
          <option>Доход</option>
          <option>Расход</option>
          <option>Перевод</option>
        </select>
      </div>
      <div className="detail-section-heading">
        <h3>История операций</h3>
        <span>Найдено: {filteredTransactions.length}</span>
      </div>
      <DetailTransactionList items={filteredTransactions} />
    </>
  );
}

export function DetailAccountsBody({
  accounts,
  accountsBalance,
  onPickAccount
}: {
  accounts: FinanceProAccount[];
  accountsBalance: number;
  onPickAccount: (name: string) => void;
}) {
  return (
    <>
      <div className="detail-total account-total">
        <div>
          <span>Общий баланс</span>
          <strong>{formatCurrency(accountsBalance)}</strong>
          <small>На всех счетах компании</small>
        </div>
        <div className="detail-total-side">
          <b>{accounts.length}</b>
          <span>счёта</span>
        </div>
      </div>
      <div className="detail-section-heading">
        <h3>Ваши счета</h3>
        <span>Нажмите для просмотра операций</span>
      </div>
      <div className="detail-account-list">
        {accounts.map((row) => (
          <button key={row.id} className="detail-account-row" onClick={() => onPickAccount(row.name)} type="button">
            <i style={{ background: `${row.color}1c`, color: row.color }}>
              <WalletCards size={19} />
            </i>
            <span>
              <b>{row.name}</b>
              <small>{row.type}</small>
            </span>
            <strong>{formatCurrency(row.amount)}</strong>
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
    </>
  );
}

export function DetailAccountBody({ account, accountTransactions }: { account: FinanceProAccount; accountTransactions: FinanceProTransaction[] }) {
  return (
    <>
      <div className="detail-total account-total">
        <div>
          <span>Доступный баланс</span>
          <strong>{formatCurrency(account.amount)}</strong>
          <small>{account.type} счёт</small>
        </div>
      </div>
      <div className="detail-section-heading">
        <h3>Операции по счёту</h3>
        <span>Всего: {accountTransactions.length}</span>
      </div>
      <DetailTransactionList items={accountTransactions} emptyMessage="По этому счёту пока нет операций." />
    </>
  );
}

export function DetailPaymentsBody({
  scheduledPayments,
  pendingPayments,
  pendingTotal
}: {
  scheduledPayments: FinanceProScheduledPayment[];
  pendingPayments: FinanceProScheduledPayment[];
  pendingTotal: number;
}) {
  const today = localDateYmd();
  return (
    <>
      <div className="detail-total payment-total">
        <div>
          <span>Ожидают оплаты</span>
          <strong>{formatCurrency(pendingTotal)}</strong>
          <small>Общая сумма запланированных платежей</small>
        </div>
        <div className="detail-total-side">
          <b>{pendingPayments.length}</b>
          <span>платежей</span>
        </div>
      </div>
      <div className="detail-section-heading">
        <h3>Календарь платежей</h3>
        <span>Всего: {scheduledPayments.length}</span>
      </div>
      <div className="detail-payment-list">
        {scheduledPayments.map((payment) => {
          const date = paymentDateParts(payment.date);
          const overdue = payment.status === "Ожидает" && payment.date < today;
          return (
            <div className="detail-payment-row" key={payment.id}>
              <span className="payment-date detail-payment-date">
                <b>{date.day}</b>
                <small>{date.month}</small>
              </span>
              <div className="detail-payment-name">
                <b>{payment.name}</b>
                <small>
                  {payment.category} · {payment.account} · {formatIsoToDot(payment.date)}
                </small>
              </div>
              <span className={`detail-payment-status ${payment.status === "Оплачено" ? "paid" : overdue ? "overdue" : ""}`}>
                {overdue ? "Просрочено" : payment.status}
              </span>
              <strong>{formatCurrency(payment.amount)}</strong>
            </div>
          );
        })}
        {scheduledPayments.length === 0 ? <div className="detail-empty">Запланированных платежей пока нет.</div> : null}
      </div>
    </>
  );
}

export function DetailChartBody({ chartData }: { chartData: FinanceProChartPoint[] }) {
  return (
    <>
      <div className="detail-metrics">
        <div>
          <span>Доход</span>
          <strong>{formatCurrency(chartData.reduce((sum, item) => sum + item.income, 0))}</strong>
        </div>
        <div>
          <span>Расход</span>
          <strong>{formatCurrency(chartData.reduce((sum, item) => sum + item.expense, 0))}</strong>
        </div>
        <div>
          <span>Прибыль</span>
          <strong>{formatCurrency(chartData.reduce((sum, item) => sum + item.profit, 0))}</strong>
        </div>
      </div>
      <div className="detail-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke="#e8eef7" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={16} tick={{ fontSize: 10, fill: "#7186a8" }} />
            <YAxis tickFormatter={(value) => compactCurrency(Number(value))} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#7186a8" }} />
            <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), String(name)]} contentStyle={{ border: "1px solid #e2eaf5", borderRadius: 9, fontSize: 11 }} />
            <Bar name="Доход" dataKey="income" fill="#29c8a9" radius={[3, 3, 0, 0]} maxBarSize={17} />
            <Bar name="Расход" dataKey="expense" fill="#ff6684" radius={[3, 3, 0, 0]} maxBarSize={17} />
            <Line name="Прибыль" dataKey="profit" stroke="#287cf4" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}