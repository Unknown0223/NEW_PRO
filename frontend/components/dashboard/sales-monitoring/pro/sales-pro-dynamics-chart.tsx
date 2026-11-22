"use client";

import { formatSalesMoney } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { downloadSalesProCsv, SalesProPanel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type { SalesProDetailView, SalesProUiModel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { Download, Maximize2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Props = {
  model: SalesProUiModel;
  onOpenDetail: (view: SalesProDetailView) => void;
};

export function SalesProDynamicsChart({ model, onOpenDetail }: Props) {
  const [chartMode, setChartMode] = useState<"Дни" | "Недели">("Дни");

  const chartData = useMemo(() => {
    if (chartMode === "Дни") return model.days;
    const weeks: { label: string; plan: number; fact: number; completion: number }[] = [];
    for (let i = 0; i < model.days.length; i += 7) {
      const chunk = model.days.slice(i, i + 7);
      const plan = chunk.reduce((a, d) => a + d.plan, 0);
      const fact = chunk.reduce((a, d) => a + d.fact, 0);
      weeks.push({
        label: `Нед. ${weeks.length + 1}`,
        plan,
        fact,
        completion: plan > 0 ? (fact / plan) * 100 : 0
      });
    }
    return weeks;
  }, [chartMode, model.days]);

  return (
    <SalesProPanel className="chart-panel">
      <div className="panel-head chart-panel-head">
        <div>
          <h2>Динамика плана и факта продаж</h2>
          <p>Ежедневное выполнение плана за выбранный месяц</p>
        </div>
        <div className="chart-actions">
          <div className="mini-segment">
            {(["Дни", "Недели"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={chartMode === item ? "selected" : ""}
                onClick={() => setChartMode(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-action"
            onClick={() => onOpenDetail({ kind: "dynamics" })}
            aria-label="Открыть подробную динамику"
            title="Подробная динамика"
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            className="icon-action"
            onClick={() =>
              downloadSalesProCsv("salec-dinamika-prodazh.csv", [
                ["Период", "План", "Факт", "Выполнение, %"],
                ...chartData.map((item) => [
                  item.label,
                  Math.round(item.plan),
                  Math.round(item.fact),
                  item.completion.toFixed(1)
                ])
              ])
            }
            aria-label="Экспортировать данные графика"
            title="Экспорт CSV"
          >
            <Download size={17} />
          </button>
        </div>
      </div>
      <div className="chart-body" style={{ height: 280 }}>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground" style={{ padding: 16 }}>
            Нет данных за период.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4eef8" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatSalesMoney(Number(v))} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatSalesMoney(value),
                  name === "plan" ? "План" : name === "fact" ? "Факт" : name
                ]}
              />
              <Area type="monotone" dataKey="plan" fill="#dfeeff" stroke="#287cf4" strokeWidth={1.5} />
              <Line type="monotone" dataKey="fact" stroke="#12bd95" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </SalesProPanel>
  );
}
