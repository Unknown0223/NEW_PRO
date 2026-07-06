"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, BarChart3, Target } from "lucide-react";

interface KpiDashboardHeaderProps {
  data: {
    totalPlannedRevenue: number;
    totalPlannedQuantity: number;
    totalPlannedVolume: number;
    totalPlannedAcb: number;
    totalPlannedOrders: number;
    completionPercentage: number;
  };
}

const kpiCards = [
  {
    title: "Общая запланированная выручка",
    key: "totalPlannedRevenue" as const,
    icon: DollarSign,
    format: formatCurrency,
    target: 5000000000,
    trend: 12.5,
    trendUp: true,
  },
  {
    title: "Общее запланированное количество",
    key: "totalPlannedQuantity" as const,
    icon: Package,
    format: formatNumber,
    target: 25000,
    trend: 8.3,
    trendUp: true,
  },
  {
    title: "Общий запланированный объем",
    key: "totalPlannedVolume" as const,
    icon: BarChart3,
    format: formatNumber,
    target: 15000,
    trend: -2.1,
    trendUp: false,
  },
  {
    title: "Общий запланированный АКБ",
    key: "totalPlannedAcb" as const,
    icon: Target,
    format: formatCurrency,
    target: 8500000,
    trend: 5.7,
    trendUp: true,
  },
  {
    title: "Общее количество заказов",
    key: "totalPlannedOrders" as const,
    icon: ShoppingCart,
    format: formatNumber,
    target: 500,
    trend: 15.2,
    trendUp: true,
  },
  {
    title: "Процент выполнения",
    key: "completionPercentage" as const,
    icon: TrendingUp,
    format: (v: number | string) => `${v}%`,
    target: 100,
    trend: 7.8,
    trendUp: true,
  },
];

export function KpiDashboardHeader({ data }: KpiDashboardHeaderProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpiCards.map((card) => {
        const value = data[card.key] as number;
        const progress = card.key === "completionPercentage" ? value : (value / card.target) * 100;
        return (
          <Card key={card.key} className="overflow-hidden border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">{card.title}</p>
                  <p className="text-lg font-bold text-slate-900">{card.format(value)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <card.icon className="h-4 w-4 text-slate-600" />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Цель: {card.format(card.target)}</span>
                  <span
                    className={`flex items-center gap-0.5 font-medium ${
                      card.trendUp ? "text-emerald-600" : "text-red-600"
                    }`}
                  >
                    {card.trendUp ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {Math.abs(card.trend)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(progress, 100)}
                  variant={progress >= 80 ? "success" : progress >= 50 ? "warning" : "default"}
                  size="sm"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
