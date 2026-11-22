"use client";

import { FinanceProPanel } from "@/components/dashboard/finance/pro/finance-pro-shared";
import { formatCurrency } from "@/components/dashboard/finance/pro/finance-pro-format";
import type { FinanceProCategoryItem, FinanceProDetailView } from "@/components/dashboard/finance/pro/finance-pro-types";
import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type Props = {
  categories: FinanceProCategoryItem[];
  onOpenDetail: (view: FinanceProDetailView) => void;
};

export function FinanceProExpenseDonut({ categories, onOpenDetail }: Props) {
  const [selectedExpense, setSelectedExpense] = useState<number | null>(null);
  const expenseTotal = categories.reduce((sum, category) => sum + category.amount, 0);
  const selectedExpenseItem = selectedExpense === null ? null : categories[selectedExpense];

  return (
    <FinanceProPanel className="expense-panel">
      <div className="panel-head">
        <div>
          <h2>Распределение расходов</h2>
          <p>Структура затрат за период</p>
        </div>
        <button className="text-link" onClick={() => onOpenDetail({ kind: "breakdown" })} type="button">
          Подробно <ArrowUpRight size={13} />
        </button>
      </div>
      <div className="expense-content">
        <div className="donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categories}
                dataKey="amount"
                innerRadius="62%"
                outerRadius="87%"
                startAngle={90}
                endAngle={-270}
                paddingAngle={1.3}
                stroke="none"
                onClick={(_, index) => setSelectedExpense((current) => (current === index ? null : index))}
              >
                {categories.map((item, index) => (
                  <Cell
                    key={item.name}
                    fill={item.color}
                    opacity={selectedExpense === null || selectedExpense === index ? 1 : 0.35}
                    cursor="pointer"
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <b>{selectedExpenseItem ? formatCurrency(selectedExpenseItem.amount) : formatCurrency(expenseTotal)}</b>
            <small>{selectedExpenseItem ? selectedExpenseItem.name : "Всего расходов"}</small>
          </div>
        </div>
        <div className="expense-list">
          {categories.map((item, index) => (
            <button
              className={selectedExpense === index ? "chosen" : ""}
              key={item.name}
              onClick={() => setSelectedExpense((current) => (current === index ? null : index))}
              type="button"
            >
              <i style={{ background: item.color }} />
              <span>{item.name}</span>
              <b>{formatCurrency(item.amount)}</b>
              <em>{item.pct.toFixed(1)}%</em>
            </button>
          ))}
        </div>
      </div>
    </FinanceProPanel>
  );
}