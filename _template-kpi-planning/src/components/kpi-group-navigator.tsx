"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { usePlanningStore } from "@/lib/store";
import { getStatusColor, getStatusLabel, formatCurrency, formatNumber } from "@/lib/utils";
import { ChevronRight, TrendingUp, DollarSign, Package, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiGroup {
  id: number;
  name: string;
  tradeDirectionId: number;
  totalCost: string | null;
  totalVolume: string | null;
  totalOrders: number | null;
  completionPercent: string | null;
  status: string | null;
}

interface KpiGroupNavigatorProps {
  groups: KpiGroup[];
}

export function KpiGroupNavigator({ groups }: KpiGroupNavigatorProps) {
  const { filters, setFilters } = usePlanningStore();

  const filteredGroups = filters.tradeDirectionId
    ? groups.filter((g) => g.tradeDirectionId === parseInt(filters.tradeDirectionId!))
    : groups;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Группы KPI</h3>
        <span className="text-xs text-slate-400">{filteredGroups.length} групп</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {filteredGroups.map((group) => {
          const isActive = filters.kpiGroupId === String(group.id);
          const completion = parseFloat(group.completionPercent || "0");
          const status = group.status || "draft";

          return (
            <Card
              key={group.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isActive
                  ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                  : "border-slate-200 bg-white"
              )}
              onClick={() => setFilters({ kpiGroupId: isActive ? null : String(group.id) })}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{group.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">ID: {group.id}</p>
                  </div>
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 mt-0.5",
                      isActive ? "text-emerald-600" : "text-slate-300"
                    )}
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <DollarSign className="h-3.5 w-3.5 mx-auto text-slate-400" />
                    <p className="text-[10px] text-slate-500 mt-0.5">Сумма</p>
                    <p className="text-xs font-semibold text-slate-700">
                      {formatCurrency(group.totalCost || "0").replace(" UZS", "")}
                    </p>
                  </div>
                  <div className="text-center">
                    <Package className="h-3.5 w-3.5 mx-auto text-slate-400" />
                    <p className="text-[10px] text-slate-500 mt-0.5">Объем</p>
                    <p className="text-xs font-semibold text-slate-700">
                      {formatNumber(group.totalVolume || "0")}
                    </p>
                  </div>
                  <div className="text-center">
                    <ShoppingCart className="h-3.5 w-3.5 mx-auto text-slate-400" />
                    <p className="text-[10px] text-slate-500 mt-0.5">Заказы</p>
                    <p className="text-xs font-semibold text-slate-700">
                      {formatNumber(group.totalOrders || 0)}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Выполнение
                    </span>
                    <span className="font-medium text-slate-700">{completion}%</span>
                  </div>
                  <Progress
                    value={completion}
                    size="sm"
                    variant={completion >= 70 ? "success" : completion >= 40 ? "warning" : "default"}
                  />
                </div>

                <div className="mt-2">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getStatusColor(status))}>
                    {getStatusLabel(status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
