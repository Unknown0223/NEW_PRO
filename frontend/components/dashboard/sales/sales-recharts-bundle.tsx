"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import { cn } from "@/lib/utils";
import { useState } from "react";
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

type ProductDonutProps = {
  kind: "product-donut";
  items: Array<{ name: string; share: number; amount?: number }>;
  colors: string[];
  showSums?: boolean;
  sumsOnLeft?: boolean;
  onActivate?: () => void;
};

type PaymentPieProps = {
  kind: "payment-pie";
  items: Array<{ name: string; value: number; color: string }>;
};

type OrdersRefusalsProps = {
  kind: "orders-refusals";
  data: Array<{ date: string; orders: number; refusals: number; notVisited: number }>;
  green: string;
  red: string;
  amber: string;
};

type RefusalBarProps = {
  kind: "refusal-bar";
  data: Array<{ reason: string; count: number }>;
  teal: string;
};

type SalesAreaProps = {
  kind: "sales-area";
  data: Array<{ date: string; amount: number; returns: number }>;
  green: string;
  red: string;
};

type Props = ProductDonutProps | PaymentPieProps | OrdersRefusalsProps | RefusalBarProps | SalesAreaProps;

function ProductDonutChart({
  items,
  colors,
  showSums,
  sumsOnLeft,
  onActivate
}: {
  items: Array<{ name: string; share: number; amount?: number }>;
  colors: string[];
  showSums?: boolean;
  sumsOnLeft?: boolean;
  onActivate?: () => void;
}) {
  const [active, setActive] = useState(0);
  const drawn = items.filter((i) => i.share > 0 || (i.amount ?? 0) > 0);
  const current = drawn[active];
  const valueOf = (item: { share: number; amount?: number }) =>
    showSums ? fmtCount(Math.round(item.amount ?? 0)) : `${item.share.toFixed(1)}%`;

  const pick = (index: number) => {
    setActive(index);
    onActivate?.();
  };

  if (drawn.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Нет продаж за выбранный период</p>;
  }

  const donut = (
      <div className="relative mx-auto h-52 w-full max-w-[220px] outline-none [&_.recharts-sector]:outline-none [&_svg]:outline-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={drawn}
              dataKey="share"
              nameKey="name"
              innerRadius={64}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              onClick={(_, index) => {
                if (typeof index === "number") pick(index);
              }}
            >
              {drawn.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={colors[index % colors.length]}
                  opacity={index === active ? 1 : 0.35}
                  style={{ cursor: "pointer", outline: "none" }}
                  onClick={() => pick(index)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {current ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <p className="line-clamp-2 max-w-[6.5rem] text-[10px] font-medium leading-tight text-slate-500">{current.name}</p>
            <p className="mt-0.5 text-lg font-black leading-none tabular-nums text-slate-950">{valueOf(current)}</p>
          </div>
        ) : null}
      </div>
    );
  const legend = (
      <div className="min-w-0 space-y-1.5">
        {drawn.map((item, index) => (
          <button
            key={item.name}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pick(index);
            }}
            className={
              index === active
                ? "flex w-full min-w-0 items-center justify-between gap-3 rounded-xl bg-teal-50 px-3 py-2 text-left text-sm"
                : "flex w-full min-w-0 items-center justify-between gap-3 rounded-xl bg-muted/80 px-3 py-2 text-left text-sm hover:bg-muted"
            }
          >
            <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index % colors.length], opacity: index === active ? 1 : 0.45 }}
              />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums text-slate-900">{valueOf(item)}</span>
          </button>
        ))}
      </div>
  );

  return (
    <div className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="grid min-w-0 items-center gap-4 md:grid-cols-2">
        <div
          className={cn(
            "min-w-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            sumsOnLeft && "md:translate-x-[calc(100%+1rem)]"
          )}
        >
          {donut}
        </div>
        <div
          className={cn(
            "min-w-0 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
            sumsOnLeft && "md:-translate-x-[calc(100%+1rem)]"
          )}
        >
          {legend}
        </div>
      </div>
    </div>
  );
}

export default function SalesRechartsBundle(props: Props) {
  if (props.kind === "product-donut") {
    return (
      <ProductDonutChart
        items={props.items}
        colors={props.colors}
        showSums={"showSums" in props ? props.showSums : false}
        sumsOnLeft={"sumsOnLeft" in props ? props.sumsOnLeft : false}
        onActivate={"onActivate" in props ? props.onActivate : undefined}
      />
    );
  }

  if (props.kind === "payment-pie") {
    const total = props.items.reduce((s, i) => s + i.value, 0);
    return (
      <div className="grid items-center gap-5 md:grid-cols-[220px_1fr] 2xl:grid-cols-1">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={props.items}
                dataKey="value"
                innerRadius={70}
                outerRadius={96}
                paddingAngle={3}
                cornerRadius={8}
                stroke="none"
              >
                {props.items.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${fmtMoney(Number(value))} UZS`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {props.items.map((item) => {
            const share = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-bold text-slate-900">{share.toFixed(1)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${share}%`, backgroundColor: item.color }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">{fmtMoney(item.value)} UZS</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (props.kind === "orders-refusals") {
    return (
      <div className="h-[330px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={props.data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis
              allowDecimals={false}
              width={36}
              domain={[0, "auto"]}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(value) => fmtCount(Number(value))} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Line
              type="monotone"
              dataKey="notVisited"
              name="Непосещение"
              stroke={props.amber}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="refusals"
              name="Отказы"
              stroke={props.red}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="orders"
              name="Заказы"
              stroke={props.green}
              strokeWidth={3}
              dot={{ r: 4, fill: props.green, stroke: "#fff", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (props.kind === "refusal-bar") {
    return (
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={props.data} margin={{ top: 12, right: 18, left: 0, bottom: 55 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="reason"
              tick={{ fontSize: 10 }}
              angle={-20}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis tick={{ fontSize: 11 }} width={42} />
            <Tooltip formatter={(value) => fmtCount(Number(value))} />
            <Bar dataKey="count" name="Кол-во" radius={[6, 6, 0, 0]} fill={props.teal} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={props.data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={props.green} stopOpacity={0.25} />
              <stop offset="100%" stopColor={props.green} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="returnsGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={props.red} stopOpacity={0.2} />
              <stop offset="100%" stopColor={props.red} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => fmtMoney(Number(v))} />
          <Tooltip formatter={(value) => `${fmtMoney(Number(value))} UZS`} />
          <Area
            type="monotone"
            dataKey="amount"
            name="Сумма продаж"
            stroke={props.green}
            strokeWidth={2.5}
            fill="url(#salesGradient)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="returns"
            name="Возврат"
            stroke={props.red}
            strokeWidth={2.5}
            fill="url(#returnsGradient)"
            dot={false}
          />
          <Legend />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
