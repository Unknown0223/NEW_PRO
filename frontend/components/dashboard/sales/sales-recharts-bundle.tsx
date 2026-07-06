"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
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
  items: Array<{ name: string; share: number }>;
  colors: string[];
};

type PaymentPieProps = {
  kind: "payment-pie";
  items: Array<{ name: string; value: number; color: string }>;
};

type OrdersRefusalsProps = {
  kind: "orders-refusals";
  data: Array<{ date: string; orders: number; refusals: number }>;
  green: string;
  red: string;
};

type RefusalBarProps = {
  kind: "refusal-bar";
  data: Array<{ reason: string; count: number }>;
  teal: string;
};

type SalesAreaProps = {
  kind: "sales-area";
  data: Array<{ date: string; amount: number }>;
  green: string;
};

type Props = ProductDonutProps | PaymentPieProps | OrdersRefusalsProps | RefusalBarProps | SalesAreaProps;

export default function SalesRechartsBundle(props: Props) {
  if (props.kind === "product-donut") {
    return (
      <div className="grid items-center gap-5 md:grid-cols-[220px_1fr]">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={props.items}
                dataKey="share"
                nameKey="name"
                innerRadius={70}
                outerRadius={96}
                paddingAngle={4}
                cornerRadius={7}
                stroke="white"
                strokeWidth={3}
              >
                {props.items.map((entry, index) => (
                  <Cell key={entry.name} fill={props.colors[index % props.colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${Number(value).toFixed(1)} %`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {props.items.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-slate-700">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: props.colors[index % props.colors.length] }}
                />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="font-bold text-slate-900">{item.share.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
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
          <LineChart data={props.data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-30} textAnchor="end" height={54} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => fmtCount(Number(value))} />
            <Legend />
            <Line
              type="monotone"
              dataKey="orders"
              name="Заявки"
              stroke={props.green}
              strokeWidth={3}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="refusals"
              name="Отказы"
              stroke={props.red}
              strokeWidth={3}
              dot={{ r: 3 }}
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
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
