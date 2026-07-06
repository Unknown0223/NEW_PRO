"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { usePlanningStore } from "@/lib/store";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
import { Users, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TradeDirection {
  id: number;
  name: string;
  code: string;
  brand: string | null;
  employeeCount: number | null;
}

interface TradeDirectionNavigatorProps {
  directions: TradeDirection[];
}

export function TradeDirectionNavigator({ directions }: TradeDirectionNavigatorProps) {
  const { filters, setFilters } = usePlanningStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Направления торговли</h3>
        <span className="text-xs text-slate-400">{directions.length} направлений</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {directions.map((dir) => {
          const isActive = filters.tradeDirectionId === String(dir.id);
          const completion = Math.floor(Math.random() * 40) + 40;
          const status = ["in_progress", "pending_approval", "approved"][Math.floor(Math.random() * 3)];

          return (
            <Card
              key={dir.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                isActive
                  ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500"
                  : "border-slate-200 bg-white"
              )}
              onClick={() => setFilters({ tradeDirectionId: isActive ? null : String(dir.id), kpiGroupId: null })}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{dir.name}</span>
                  <ArrowRight className={cn("h-3.5 w-3.5", isActive ? "text-emerald-600" : "text-slate-300")} />
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Users className="h-3 w-3" />
                  <span>{dir.employeeCount} сотрудников</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">Выполнение</span>
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
