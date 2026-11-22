"use client";

import { FinanceProPanel } from "@/components/dashboard/finance/pro/finance-pro-shared";
import { compactCurrency, formatCurrency } from "@/components/dashboard/finance/pro/finance-pro-format";
import type { FinanceProChartPoint, FinanceProDetailView } from "@/components/dashboard/finance/pro/finance-pro-types";
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

type ChartRangeKey = "Дни" | "Недели" | "Месяцы";

type Props = {
  points: FinanceProChartPoint[];
  onOpenDetail: (view: FinanceProDetailView) => void;
  onExport: (rows: FinanceProChartPoint[]) => void;
};

function bucketChart(points: FinanceProChartPoint[], range: ChartRangeKey): FinanceProChartPoint[] {
  if (range === "Месяцы" || range === "Дни") return points;
  const groups: FinanceProChartPoint[] = [];
  for (let index = 0; index < points.length; index += 7) {
    const group = points.slice(index, index + 7);
    groups.push({
      label: `Неделя ${groups.length + 1}`,
      income: group.reduce((sum, item) => sum + item.income, 0),
      expense: group.reduce((sum, item) => sum + item.expense, 0),
      profit: group.reduce((sum, item) => sum + item.profit, 0)
    });
  }
  return groups;
}

export function FinanceProCashflowChart({ points, onOpenDetail, onExport }: Props) {
  const [chartRange, setChartRange] = useState<ChartRangeKey>("Дни");
  const [chartVisibility, setChartVisibility] = useState({ income: true, expense: true, profit: true });

  const chartData = useMemo(() => bucketChart(points, chartRange), [points, chartRange]);

  return (
    <FinanceProPanel className="main-chart">
      <div className="panel-head chart-panel-head">
        <div>
          <h2>Динамика доходов и расходов</h2>
          <p>Движение денежных средств за выбранный период</p>
        </div>
        <div className="chart-actions">
          <div className="mini-segment">
            {(["Дни", "Недели", "Месяцы"] as const).map((item) => (
              <button
                className={chartRange === item ? "selected" : ""}
                onClick={() => setChartRange(item)}
                key={item}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <button
            className="icon-action"
            onClick={() => onOpenDetail({ kind: "chart" })}
            aria-label="Открыть подробную динамику"
            title="Подробная динамика"
            type="button"
          >
            <Maximize2 size={16} />
          </button>
          <button
            className="icon-action"
            onClick={() => onExport(chartData)}
            aria-label="Экспортировать данные графика"
            title="Экспорт CSV"
            type="button"
          >
            <Download size={17} />
          </button>
        </div>
      </div>
      <div className="legend">
        <button
          className={chartVisibility.income ? "" : "muted"}
          onClick={() => setChartVisibility((current) => ({ ...current, income: !current.income }))}
          aria-pressed={chartVisibility.income}
          type="button"
        >
          <i className="green" />
          Доход
        </button>
        <button
          className={chartVisibility.expense ? "" : "muted"}
          onClick={() => setChartVisibility((current) => ({ ...current, expense: !current.expense }))}
          aria-pressed={chartVisibility.expense}
          type="button"
        >
          <i className="pink" />
          Расход
        </button>
        <button
          className={chartVisibility.profit ? "" : "muted"}
          onClick={() => setChartVisibility((current) => ({ ...current, profit: !current.profit }))}
          aria-pressed={chartVisibility.profit}
          type="button"
        >
          <i className="blue" />
          Прибыль
        </button>
      </div>
      <div className="chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="#e8eef7" vertical={false} />
            <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={14} tick={{ fontSize: 10, fill: "#7186a8" }} />
            <YAxis
              domain={[0, "dataMax"]}
              tickCount={5}
              tickFormatter={(value) => compactCurrency(Number(value))}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: "#7186a8" }}
            />
            <Tooltip
              formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
              contentStyle={{ border: "1px solid #e2eaf5", borderRadius: 9, fontSize: 11, boxShadow: "0 8px 24px #29466c18" }}
            />
            <Bar
              hide={!chartVisibility.income}
              name="Доход"
              dataKey="income"
              fill="#29c8a9"
              radius={[3, 3, 0, 0]}
              barSize={chartRange === "Дни" ? 7 : 17}
            />
            <Bar
              hide={!chartVisibility.expense}
              name="Расход"
              dataKey="expense"
              fill="#ff6684"
              radius={[3, 3, 0, 0]}
              barSize={chartRange === "Дни" ? 7 : 17}
            />
            <Line
              hide={!chartVisibility.profit}
              name="Прибыль"
              type="monotone"
              dataKey="profit"
              stroke="#287cf4"
              strokeWidth={2.2}
              dot={{ r: 2, fill: "#ffffff", strokeWidth: 1.5 }}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </FinanceProPanel>
  );
}