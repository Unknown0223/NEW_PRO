"use client";

import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { num } from "@/components/dashboard/monitoring/utils";
import { formatNumberGrouped } from "@/lib/format-numbers";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const PIE_FILL = ["#3b82f6", "#0ea5e9", "#10b981", "#f59e0b", "#22c55e", "#8b5cf6", "#ec4899", "#64748b"];

export function MonitoringChannelsBar({
  channels,
  height = 260
}: {
  channels: MonitoringSnapshot["sales_channels"];
  height?: number;
}) {
  const data = useMemo(() => {
    if (!channels.length) {
      return [{ channel: "—", plan: 0, fact: 0 }];
    }
    return channels.map((r) => ({
      channel: r.channel,
      plan: 0,
      fact: num(r.sales_sum)
    }));
  }, [channels]);

  const hasFact = data.some((r) => r.fact > 0);

  return (
    <div className="relative" style={{ height }}>
      {!hasFact ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rounded-md bg-card/80 px-2 py-1 text-[11px] text-slate-500">Нет продаж по каналам</span>
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={24} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 11 }} stroke="#94a3b8" tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
          />
          <Tooltip
            formatter={(v: number, name) => [
              formatNumberGrouped(v, { maxFractionDigits: 0 }),
              String(name) === "plan" ? "План" : "Факт"
            ]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="plan" fill="#e2e8f0" radius={[6, 6, 0, 0]} name="План" maxBarSize={48} />
          <Bar dataKey="fact" fill="#0d9488" radius={[6, 6, 0, 0]} name="Факт" maxBarSize={48} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryDonutLegend({ slices }: { slices: Array<{ name: string; share_pct?: number; status: string }> }) {
  if (slices.length === 0) {
    return (
      <div className="mt-2 space-y-1.5 text-[12px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-muted" />
          <span className="flex-1">Нет данных</span>
          <span className="font-medium">0%</span>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 max-h-[120px] space-y-1.5 overflow-y-auto">
      {slices.map((c, i) => (
        <div key={c.status} className="flex items-center gap-2 text-[12px]">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: PIE_FILL[i % PIE_FILL.length] }} />
          <span className="flex-1 truncate text-slate-600">{c.name}</span>
          <span className="font-medium tabular-nums">
            {c.share_pct != null ? `${c.share_pct.toFixed(1)}%` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
