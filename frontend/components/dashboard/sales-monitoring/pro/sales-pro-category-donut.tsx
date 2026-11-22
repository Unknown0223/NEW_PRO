"use client";

import { formatSalesMoney } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { SalesProPanel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type { SalesProDetailView, SalesProUiModel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { ArrowUpRight } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type Props = {
  model: SalesProUiModel;
  onOpenDetail: (view: SalesProDetailView) => void;
};

export function SalesProCategoryDonut({ model, onOpenDetail }: Props) {
  return (
    <SalesProPanel>
      <div className="panel-head">
        <div>
          <h2>Факт продаж по категориям</h2>
          <p>Структура продаж за месяц</p>
        </div>
        <button type="button" className="text-link" onClick={() => onOpenDetail({ kind: "categories" })}>
          Подробно <ArrowUpRight size={13} />
        </button>
      </div>
      {model.categoryRows.length === 0 ? (
        <p className="text-sm text-muted-foreground" style={{ padding: 16 }}>
          Нет категорий.
        </p>
      ) : (
        <div className="expense-content">
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={model.categoryRows}
                  dataKey="amount"
                  innerRadius="62%"
                  outerRadius="87%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={1.3}
                  stroke="none"
                >
                  {model.categoryRows.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <b>{formatSalesMoney(model.fact)}</b>
              <small>Факт продаж</small>
            </div>
          </div>
          <div className="expense-list">
            {model.categoryRows.map((item) => (
              <button key={item.name} type="button" onClick={() => onOpenDetail({ kind: "categories" })}>
                <i style={{ background: item.color }} />
                <span>{item.name}</span>
                <b>{formatSalesMoney(item.amount)}</b>
                <em>{item.pct.toFixed(1)}%</em>
              </button>
            ))}
          </div>
        </div>
      )}
    </SalesProPanel>
  );
}
