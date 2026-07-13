import {
  getPivotStrings,
  pivotChartDataToRechartsRows,
  type PivotChartData,
  type PivotChartType
} from "@salec/pivot-engine";
import { forwardRef } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

const CHART_COLORS = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#7c3aed", "#0891b2"];

export const PivotChart = forwardRef<HTMLDivElement, Props>(function PivotChart(
  { data, className, chartType = "bar", onChartTypeChange, warnings = [] },
  ref
) {
  const t = getPivotStrings();
  const rows = pivotChartDataToRechartsRows(data);

  const ChartComponent = chartType === "line" ? LineChart : BarChart;

  return (
    <div ref={ref} className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {onChartTypeChange && (
          <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs">
            <button
              type="button"
              className={`rounded px-2 py-1 ${chartType === "bar" ? "bg-zinc-100 font-medium" : ""}`}
              onClick={() => onChartTypeChange("bar")}
            >
              {t.chart.bar}
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${chartType === "line" ? "bg-zinc-100 font-medium" : ""}`}
              onClick={() => onChartTypeChange("line")}
            >
              {t.chart.line}
            </button>
          </div>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mb-2 space-y-1">
          {warnings.map((warning) => (
            <p key={warning} className="text-xs text-amber-700">
              {warning}
            </p>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={360}>
        <ChartComponent data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="category" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {data.series.map((series, idx) =>
            chartType === "line" ? (
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
            ) : (
              <Bar
                key={series.id}
                dataKey={series.id}
                name={series.label}
                fill={CHART_COLORS[idx % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            )
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
});
