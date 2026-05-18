"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
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
import { formatGroupedInteger, formatNumberGrouped } from "@/lib/format-numbers";

const PIE_FILL = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#64748b", "#06b6d4", "#84cc16"];

function moneyTooltip(v: number) {
  return formatNumberGrouped(v, { maxFractionDigits: 0 }) + " сум";
}

type DayActivityProps = {
  ordersToday: number;
  ordersActive: number;
  paymentsToday: number;
  returnsToday: number;
};

export function DashboardDayActivityChart({ ordersToday, ordersActive, paymentsToday, returnsToday }: DayActivityProps) {
  const data = [
    { name: "Заказы", soni: ordersToday },
    { name: "В работе", soni: ordersActive },
    { name: "Платежи", soni: paymentsToday },
    { name: "Возвраты", soni: returnsToday }
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} className="text-muted-foreground" />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} className="text-muted-foreground" />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [formatGroupedInteger(v), "Кол-во"]}
        />
        <Bar dataKey="soni" fill="var(--primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type TrendRow = { dateShort: string; orders: number; revenue: number };

export function ReportsTrendCharts({ rows }: { rows: TrendRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis dataKey="dateShort" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [formatGroupedInteger(v), "Заказы"]}
          />
          <Line type="monotone" dataKey="orders" stroke="var(--primary)" strokeWidth={2} dot={false} name="Заказы" />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis dataKey="dateShort" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} width={44} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(v: number) => [moneyTooltip(v), "Выручка"]}
          />
          <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Выручка" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type StatusSlice = { status: string; name: string; value: number };

export type ShareDonutSlice = StatusSlice & {
  share_pct?: number;
  orders_count?: number;
  line_qty?: number;
};

/** Доля продаж (сумма) — donut, высота по умолчанию для мониторинга */
export function SalesShareDonut({
  slices,
  height = 320,
  valueLabel = "Сумма, сум"
}: {
  slices: ShareDonutSlice[];
  height?: number;
  valueLabel?: string;
}) {
  if (slices.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground"
        style={{ height }}
      >
        Нет данных
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={height > 300 ? 72 : 56}
          outerRadius={height > 300 ? 108 : 88}
          paddingAngle={1}
          label={false}
        >
          {slices.map((_, i) => (
            <Cell key={slices[i].status} fill={PIE_FILL[i % PIE_FILL.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as ShareDonutSlice;
            if (!row) return null;
            return (
              <div className="max-w-[220px] rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md">
                <div className="font-medium text-foreground">{row.name}</div>
                <div className="mt-1 text-muted-foreground">
                  {valueLabel}:{" "}
                  <span className="font-medium text-foreground">
                    {formatNumberGrouped(row.value, { maxFractionDigits: 0 })}
                  </span>
                </div>
                {row.share_pct != null ? (
                  <div className="text-muted-foreground">
                    Доля: <span className="font-medium text-foreground">{row.share_pct.toFixed(1)}%</span>
                  </div>
                ) : null}
                {row.orders_count != null ? (
                  <div className="text-muted-foreground">
                    Заказов: <span className="font-medium text-foreground">{formatGroupedInteger(row.orders_count)}</span>
                  </div>
                ) : null}
                {row.line_qty != null ? (
                  <div className="text-muted-foreground">
                    Кол-во (шт.):{" "}
                    <span className="font-medium text-foreground">{formatNumberGrouped(row.line_qty, { maxFractionDigits: 0 })}</span>
                  </div>
                ) : null}
              </div>
            );
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

type DailyRev = { day: string; revenue: number };

/** Одна линия: сумма продаж по дням месяца; cumulative — накопительный итог */
export function MonitoringDailyRevenueLine({ rows, cumulative = false }: { rows: DailyRev[]; cumulative?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Нет данных
      </div>
    );
  }
  const data = useMemo(() => {
    let run = 0;
    return rows.map((r) => {
      run += r.revenue;
      return {
        ...r,
        dayShort: r.day.length >= 10 ? r.day.slice(8, 10) : r.day,
        revenue: cumulative ? run : r.revenue
      };
    });
  }, [rows, cumulative]);
  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey="dayShort" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis
          tick={{ fontSize: 10 }}
          width={48}
          tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [moneyTooltip(v), "Продажи"]}
        />
        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Сумма" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export type ClientMatrixDayPoint = { dayKey: string; label: string; total: number };

/** Суммы по дням (итоги столбцов матрицы «Клиент × день») — одна area-диаграмма */
export function MonitoringClientDayColumnTotalsChart({
  daySeries,
  height = 260
}: {
  daySeries: ClientMatrixDayPoint[];
  height?: number;
}) {
  const hasDayData = daySeries.length > 0 && daySeries.some((d) => d.total > 0);
  if (!hasDayData) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/15 text-xs text-muted-foreground"
        style={{ minHeight: height }}
      >
        Нет сумм по дням
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-lg border border-border/80 bg-card/50 p-2 shadow-sm">
      <div className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">Суммы по дням (итоги столбцов)</div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={daySeries} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            tick={{ fontSize: 10 }}
            width={40}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as ClientMatrixDayPoint;
              if (!row) return null;
              return (
                <div className="rounded-md border border-border bg-popover px-2.5 py-2 text-xs shadow-md">
                  <div className="font-medium text-foreground">{row.dayKey.length >= 10 ? row.dayKey.slice(0, 10) : row.dayKey}</div>
                  <div className="mt-1 text-muted-foreground">
                    Сумма:{" "}
                    <span className="font-medium text-foreground">
                      {formatNumberGrouped(row.total, { maxFractionDigits: 0 })}
                    </span>{" "}
                    сум
                  </div>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="total" stroke="#0d9488" fill="#14b8a6" fillOpacity={0.22} name="Сумма" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

type YoYBarRow = { name: string; previous: number; current: number };

/** Сгруппированные столбцы: прошлый год vs текущий */
export function MonitoringYearComparisonBars({ rows, height = 280 }: { rows: YoYBarRow[]; height?: number }) {
  if (rows.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 10 }} width={44} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : String(v))} />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
          formatter={(v: number, name) => [
            formatNumberGrouped(v, { maxFractionDigits: 2 }),
            String(name) === "previous" ? "Прошлый год" : "Текущий"
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          formatter={(value) => (value === "previous" ? "Прошлый год" : "Текущий")}
        />
        <Bar dataKey="previous" fill="#94a3b8" name="previous" radius={[4, 4, 0, 0]} />
        <Bar dataKey="current" fill="var(--primary)" name="current" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportsStatusPie({ slices }: { slices: StatusSlice[] }) {
  if (slices.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={92}
          label={false}
        >
          {slices.map((_, i) => (
            <Cell key={slices[i].status} fill={PIE_FILL[i % PIE_FILL.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [formatGroupedInteger(v), "Заказы"]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

type ProductBar = { label: string; revenue: number };

export function ReportsTopProductsBar({ items }: { items: ProductBar[] }) {
  if (items.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.min(360, 40 + items.length * 28)}>
      <BarChart data={items} layout="vertical" margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}k`)} />
        <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [moneyTooltip(v), "Сумма"]} />
        <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

type ChannelBar = { label: string; orders: number };

export function ReportsChannelOrdersBar({ items }: { items: ChannelBar[] }) {
  if (items.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={Math.min(320, 40 + items.length * 26)}>
      <BarChart data={items} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 10 }} />
        <Tooltip
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
          formatter={(v: number) => [formatGroupedInteger(v), "Заказы"]}
        />
        <Bar dataKey="orders" fill="#0d9488" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
