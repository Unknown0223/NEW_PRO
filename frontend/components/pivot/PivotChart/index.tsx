"use client";

import {
  getPivotStrings,
  pivotChartDataToRechartsRows,
  type PivotChartData,
  type PivotChartType
} from "@salec/pivot-engine";
import { forwardRef, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Props = {
  data: PivotChartData;
  className?: string;
  chartType?: PivotChartType;
  onChartTypeChange?: (type: PivotChartType) => void;
  warnings?: string[];
};

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export const PivotChart = forwardRef<HTMLDivElement, Props>(function PivotChart(
  { data, className, chartType = "bar", onChartTypeChange, warnings = [] },
  ref
) {
  const t = getPivotStrings();
  const rows = pivotChartDataToRechartsRows(data);
  const pieRows = useMemo(() => {
    if (!data.series[0]) return [];
    return data.categories.map((category, idx) => ({
      name: category,
      value: data.series[0]?.data[idx] ?? 0
    }));
  }, [data]);

  return (
    <div ref={ref} className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {onChartTypeChange && (
          <div className="inline-flex rounded-md border border-border bg-background p-0.5 text-xs">
            {(["bar", "line", "pie"] as PivotChartType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`rounded px-2 py-1 ${chartType === type ? "bg-muted font-medium" : ""}`}
                onClick={() => onChartTypeChange(type)}
              >
                {t.chart[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mb-2 space-y-1">
          {warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700 dark:text-amber-400">
              {warning}
            </p>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={360}>
        {chartType === "pie" ? (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={pieRows} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label>
              {pieRows.map((_, idx) => (
                <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : chartType === "line" ? (
          <LineChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {data.series.map((series, idx) => (
              <Line
                key={series.id}
                type="monotone"
                dataKey={series.id}
                name={series.label}
                stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {data.series.map((series, idx) => (
              <Bar
                key={series.id}
                dataKey={series.id}
                name={series.label}
                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
});
