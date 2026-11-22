"use client";

import { compactSalesMoney, formatSalesMoney } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { downloadSalesProCsv, SalesProPanel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type { SalesProDetailView, SalesProUiModel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { Download, Maximize2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
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
    const days = model.days;
    if (chartMode === "Дни") return days;
    const weeks: { label: string; plan: number; fact: number; completion: number }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
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
    <SalesProPanel className="main-chart">
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
      <div className="legend">
        <span>
          <i className="green" />
          Факт
        </span>
        <span>
          <i className="blue" />
          План
        </span>
        <span>
          <i className="pink" />
          Выполнение
        </span>
      </div>
      <div className="chart-area">
        {chartData.length === 0 ? (
          <div className="empty">Нет данных за период.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#e8eef7" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={14}
                tick={{ fontSize: 10, fill: "#7186a8" }}
              />
              <YAxis
                yAxisId="money"
                domain={[0, "dataMax"]}
                tickCount={5}
                tickFormatter={(value) => compactSalesMoney(Number(value))}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#7186a8" }}
              />
              <YAxis
                yAxisId="percent"
                orientation="right"
                domain={[0, 160]}
                tickFormatter={(value) => `${value}%`}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#7186a8" }}
                width={38}
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "Выполнение"
                    ? [`${Number(value).toFixed(1)}%`, name]
                    : [formatSalesMoney(Number(value)), name]
                }
                contentStyle={{
                  border: "1px solid #e2eaf5",
                  borderRadius: 9,
                  fontSize: 11,
                  boxShadow: "0 8px 24px #29466c18"
                }}
              />
              <Bar
                yAxisId="money"
                name="Факт"
                dataKey="fact"
                fill="#12bd95"
                radius={[3, 3, 0, 0]}
                barSize={chartMode === "Дни" ? 8 : 21}
              />
              <Line
                yAxisId="money"
                name="План"
                dataKey="plan"
                stroke="#287cf4"
                strokeWidth={2.1}
                dot={false}
                strokeDasharray="5 4"
              />
              <Line
                yAxisId="percent"
                name="Выполнение"
                dataKey="completion"
                stroke="#ff6684"
                strokeWidth={1.8}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </SalesProPanel>
  );
}
