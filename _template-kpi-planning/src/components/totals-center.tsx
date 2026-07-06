"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatNumber, getRoleLabel } from "@/lib/utils";
import { DollarSign, Package, BarChart3, Target, ShoppingCart } from "lucide-react";

interface Employee {
  id: number;
  name: string;
  role: string;
}

interface KpiTarget {
  employeeId: number;
  cost: string | null;
  count: string | null;
  volume: string | null;
  acb: string | null;
  orderCount: number | null;
}

interface TotalsCenterProps {
  employees: Employee[];
  kpiTargets: KpiTarget[];
}

function calculateTotals(targets: KpiTarget[]) {
  return {
    cost: targets.reduce((sum, t) => sum + parseFloat(t.cost || "0"), 0),
    count: targets.reduce((sum, t) => sum + parseFloat(t.count || "0"), 0),
    volume: targets.reduce((sum, t) => sum + parseFloat(t.volume || "0"), 0),
    acb: targets.reduce((sum, t) => sum + parseFloat(t.acb || "0"), 0),
    orders: targets.reduce((sum, t) => sum + (t.orderCount || 0), 0),
  };
}

const metricIcons = {
  cost: DollarSign,
  count: Package,
  volume: BarChart3,
  acb: Target,
  orders: ShoppingCart,
};

export function TotalsCenter({ employees, kpiTargets }: TotalsCenterProps) {
  const allTotals = calculateTotals(kpiTargets);

  const roleTotals = ["director", "sales_director", "commercial_director", "manager", "supervisor", "agent"].map(
    (role) => {
      const roleEmpIds = employees.filter((e) => e.role === role).map((e) => e.id);
      const roleTargets = kpiTargets.filter((t) => roleEmpIds.includes(t.employeeId));
      return {
        role,
        label: getRoleLabel(role),
        ...calculateTotals(roleTargets),
      };
    }
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Итоговый центр</h3>
      </div>

      <Tabs value="general" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="general">Общие итоги</TabsTrigger>
          <TabsTrigger value="role">По ролям</TabsTrigger>
          <TabsTrigger value="detailed">Детальные</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(allTotals).map(([key, value]) => {
              const Icon = metricIcons[key as keyof typeof metricIcons];
              return (
                <Card key={key}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <Icon className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 capitalize">{key === "cost" ? "Сумма" : key === "count" ? "Количество" : key === "volume" ? "Объем" : key === "acb" ? "АКБ" : "Заказы"}</p>
                        <p className="text-lg font-bold text-slate-900">
                          {key === "orders" ? formatNumber(value) : formatCurrency(value).replace(" UZS", "")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="role">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700">Роль</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Сумма</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Количество</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Объем</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">АКБ</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Заказы</th>
                </tr>
              </thead>
              <tbody>
                {roleTotals.map((row) => (
                  <tr key={row.role} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-2 text-xs font-medium text-slate-900">{row.label}</td>
                    <td className="px-4 py-2 text-xs text-right text-slate-700">{formatCurrency(row.cost)}</td>
                    <td className="px-4 py-2 text-xs text-right text-slate-700">{formatNumber(row.count)}</td>
                    <td className="px-4 py-2 text-xs text-right text-slate-700">{formatNumber(row.volume)}</td>
                    <td className="px-4 py-2 text-xs text-right text-slate-700">{formatCurrency(row.acb)}</td>
                    <td className="px-4 py-2 text-xs text-right text-slate-700">{formatNumber(row.orders)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-xs text-slate-900">Всего</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatCurrency(allTotals.cost)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatNumber(allTotals.count)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatNumber(allTotals.volume)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatCurrency(allTotals.acb)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatNumber(allTotals.orders)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="detailed">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700">Сотрудник</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-700">Роль</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Сумма</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Количество</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Объем</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">АКБ</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Заказы</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const target = kpiTargets.find((t) => t.employeeId === emp.id);
                  return (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-xs font-medium text-slate-900">{emp.name}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{getRoleLabel(emp.role)}</td>
                      <td className="px-4 py-2 text-xs text-right text-slate-700">{formatCurrency(parseFloat(target?.cost || "0"))}</td>
                      <td className="px-4 py-2 text-xs text-right text-slate-700">{formatNumber(parseFloat(target?.count || "0"))}</td>
                      <td className="px-4 py-2 text-xs text-right text-slate-700">{formatNumber(parseFloat(target?.volume || "0"))}</td>
                      <td className="px-4 py-2 text-xs text-right text-slate-700">{formatCurrency(parseFloat(target?.acb || "0"))}</td>
                      <td className="px-4 py-2 text-xs text-right text-slate-700">{formatNumber(target?.orderCount || 0)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-2 text-xs text-slate-900" colSpan={2}>Всего</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatCurrency(allTotals.cost)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatNumber(allTotals.count)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatNumber(allTotals.volume)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatCurrency(allTotals.acb)}</td>
                  <td className="px-4 py-2 text-xs text-right text-slate-900">{formatNumber(allTotals.orders)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
