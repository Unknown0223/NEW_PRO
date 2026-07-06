"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { History, ArrowRight, User, Clock } from "lucide-react";

interface AuditLog {
  id: number;
  planId: number;
  employeeId: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  userName: string | null;
  createdAt: Date | null;
}

interface AuditTrailProps {
  logs: AuditLog[];
}

const fieldLabels: Record<string, string> = {
  cost: "Сумма",
  count: "Количество",
  volume: "Объем",
  acb: "АКБ",
  orderCount: "Заказы",
  status: "Статус",
};

export function AuditTrail({ logs }: AuditTrailProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">История изменений</h3>
        <Badge variant="outline" className="text-xs">
          {logs.length} записей
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            Аудит
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {logs.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Нет записей</p>
            )}
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
              >
                <div className="mt-0.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                    <User className="h-3.5 w-3.5" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-900">{log.userName || "Система"}</span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("ru-RU") : "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{fieldLabels[log.field] || log.field}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-700 font-medium">
                        {log.field === "cost" || log.field === "acb"
                          ? formatCurrency(log.oldValue || "0")
                          : log.oldValue || "0"}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 font-medium">
                        {log.field === "cost" || log.field === "acb"
                          ? formatCurrency(log.newValue || "0")
                          : log.newValue || "0"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
