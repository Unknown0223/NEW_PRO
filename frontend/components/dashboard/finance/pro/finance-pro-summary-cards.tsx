"use client";

import { FinanceProPanel } from "@/components/dashboard/finance/pro/finance-pro-shared";
import { formatChangePct, formatCurrency } from "@/components/dashboard/finance/pro/finance-pro-format";
import type { FinanceProUiModel } from "@/components/dashboard/finance/pro/finance-pro-types";
import type { FinanceProDetailView } from "@/components/dashboard/finance/pro/finance-pro-types";
import {
  ArrowUpRight,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  TrendingUp,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

type Props = {
  model: FinanceProUiModel;
  onOpenDetail: (view: FinanceProDetailView) => void;
};

function SummaryCard({
  label,
  value,
  changePct,
  color,
  bg,
  icon: Icon,
  spark,
  caption,
  onDetails,
  negative = false
}: {
  label: string;
  value: number;
  changePct: number | null;
  color: string;
  bg: string;
  icon: LucideIcon;
  spark: number[];
  caption: string;
  onDetails: () => void;
  negative?: boolean;
}) {
  const gradientId = `spark-${label.replace(/\s/g, "-")}`;
  const change = formatChangePct(changePct, negative);
  return (
    <FinanceProPanel className="summary">
      <button className="summary-open" onClick={onDetails} aria-label={`Подробнее: ${label}`} title="Подробнее" type="button">
        <ArrowUpRight size={14} />
      </button>
      <div className="summary-top">
        <div className="summary-icon" style={{ background: bg, color }}>
          <Icon size={22} />
        </div>
        <div className="summary-body">
          <span>{label}</span>
          <div className="summary-number">
            <b>{formatCurrency(value)}</b>
            <em className={negative ? "change-negative" : ""} style={{ color: negative ? "#ff466e" : color }}>
              <TrendingUp size={13} />
              {change}
            </em>
          </div>
          <small>{caption}</small>
        </div>
      </div>
      <div className="spark">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark.map((item, index) => ({ index, value: item }))}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <Area type="linear" dataKey="value" stroke={color} strokeWidth={1.6} fill={`url(#${gradientId})`} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </FinanceProPanel>
  );
}

export function FinanceProSummaryCards({ model, onOpenDetail }: Props) {
  return (
    <div className="summary-grid">
      <SummaryCard
        label="Общий доход"
        value={model.totalIncome}
        changePct={model.incomeChangePct}
        color="#13bf9b"
        bg="#d8f8ee"
        icon={CircleDollarSign}
        spark={model.incomeSpark}
        caption="За выбранный период"
        onDetails={() => onOpenDetail({ kind: "income" })}
      />
      <SummaryCard
        label="Общие расходы"
        value={model.totalExpense}
        changePct={model.expenseChangePct}
        color="#ff466e"
        bg="#ffe0e7"
        icon={WalletCards}
        spark={model.expenseSpark}
        caption="За выбранный период"
        onDetails={() => onOpenDetail({ kind: "breakdown" })}
        negative
      />
      <SummaryCard
        label="Чистая прибыль"
        value={model.totalProfit}
        changePct={model.profitChangePct}
        color="#287cf4"
        bg="#dfeeff"
        icon={ChartNoAxesCombined}
        spark={model.profitSpark}
        caption="Доходы за вычетом расходов"
        onDetails={() => onOpenDetail({ kind: "chart" })}
      />
      <SummaryCard
        label="Баланс счетов"
        value={model.accountsBalance}
        changePct={model.balanceChangePct}
        color="#9147ed"
        bg="#ecddff"
        icon={Building2}
        spark={model.balanceSpark}
        caption="На всех счетах"
        onDetails={() => onOpenDetail({ kind: "accounts" })}
      />
    </div>
  );
}