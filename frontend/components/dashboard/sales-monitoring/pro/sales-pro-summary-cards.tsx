"use client";

import { formatSalesMoney, formatSalesPct } from "@/components/dashboard/sales-monitoring/pro/sales-pro-format";
import { SalesProPanel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-shared";
import type { SalesProDetailView, SalesProUiModel } from "@/components/dashboard/sales-monitoring/pro/sales-pro-types";
import { ArrowUpRight, ChartNoAxesCombined, Target, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

type Props = {
  model: SalesProUiModel;
  monthLabel: string;
  onOpenDetail: (view: SalesProDetailView) => void;
};

function SummaryCard({
  label,
  valueText,
  change,
  color,
  bg,
  icon: Icon,
  spark,
  caption,
  onDetails
}: {
  label: string;
  valueText: string;
  change: string;
  color: string;
  bg: string;
  icon: LucideIcon;
  spark: number[];
  caption: string;
  onDetails: () => void;
}) {
  const gradientId = `sales-spark-${label.replace(/\s/g, "-")}`;
  return (
    <SalesProPanel className="summary">
      <button
        className="summary-open"
        onClick={onDetails}
        aria-label={`Подробнее: ${label}`}
        title="Подробнее"
        type="button"
      >
        <ArrowUpRight size={14} />
      </button>
      <div className="summary-top">
        <div className="summary-icon" style={{ background: bg, color }}>
          <Icon size={22} />
        </div>
        <div className="summary-body">
          <span>{label}</span>
          <div className="summary-number">
            <b>{valueText}</b>
            <em style={{ color }}>
              <TrendingUp size={13} />
              {change}
            </em>
          </div>
          <small>{caption}</small>
        </div>
      </div>
      <div className="spark">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={spark.map((item, index) => ({ index, value: item }))}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                <stop offset="100%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <Area
              type="linear"
              dataKey="value"
              stroke={color}
              strokeWidth={1.6}
              fill={`url(#${gradientId})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SalesProPanel>
  );
}

export function SalesProSummaryCards({ model, monthLabel, onOpenDetail }: Props) {
  const daySpark = model.days.map((d) => d.fact);
  const planSpark = model.days.map((d) => d.plan || model.plan / Math.max(model.days.length, 1));
  const completionSpark = model.days.map((d) => d.completion || (model.completionPct ?? 0));
  const akbSpark = model.branchRows.map((r) => r.akb);

  return (
    <div className="summary-grid">
      <SummaryCard
        label="План продаж"
        valueText={formatSalesMoney(model.plan)}
        change={`${model.days.filter((d) => d.fact >= d.plan && d.plan > 0).length} дней выше плана`}
        color="#287cf4"
        bg="#dfeeff"
        icon={Target}
        spark={planSpark.length ? planSpark : [model.plan]}
        caption={monthLabel}
        onDetails={() => onOpenDetail({ kind: "plan" })}
      />
      <SummaryCard
        label="Факт продаж"
        valueText={formatSalesMoney(model.fact)}
        change={`${model.branchRows.length} филиалов`}
        color="#12bd95"
        bg="#dcf8ee"
        icon={TrendingUp}
        spark={daySpark.length ? daySpark : [model.fact]}
        caption={monthLabel}
        onDetails={() => onOpenDetail({ kind: "sales" })}
      />
      <SummaryCard
        label="Выполнение плана"
        valueText={formatSalesPct(model.completionPct)}
        change={model.agentRows.length ? `${model.agentRows.length} в разрезе` : "нет данных"}
        color={(model.completionPct ?? 0) >= 100 ? "#12bd95" : "#f7b62d"}
        bg={(model.completionPct ?? 0) >= 100 ? "#dcf8ee" : "#fff4dc"}
        icon={ChartNoAxesCombined}
        spark={completionSpark.length ? completionSpark : [model.completionPct ?? 0]}
        caption="Факт к плану"
        onDetails={() => onOpenDetail({ kind: "dynamics" })}
      />
      <SummaryCard
        label="АКБ клиентов"
        valueText={String(model.akb)}
        change={`${model.okb} ОКБ`}
        color="#9147ed"
        bg="#ecddff"
        icon={Users}
        spark={akbSpark.length ? akbSpark : [model.akb]}
        caption={`Из ${model.okb} активной базы`}
        onDetails={() => onOpenDetail({ kind: "okb" })}
      />
    </div>
  );
}
