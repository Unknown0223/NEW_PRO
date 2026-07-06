"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface Employee {
  id: number;
  name: string;
  role: string;
}

interface KpiTarget {
  employeeId: number;
  cost: string | null;
  volume: string | null;
  acb: string | null;
  orderCount: number | null;
}

interface KpiAnalyticsProps {
  employees: Employee[];
  kpiTargets: KpiTarget[];
}

const COLORS = ["#0f766e", "#14b8a6", "#5eead4", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function KpiAnalytics({ employees, kpiTargets }: KpiAnalyticsProps) {
  const managers = employees.filter((e) => e.role === "manager" || e.role === "supervisor");

  const revenueData = managers.map((emp) => {
    const target = kpiTargets.find((t) => t.employeeId === emp.id);
    return {
      name: emp.name.split(" ")[0],
      value: parseFloat(target?.cost || "0"),
    };
  });

  const volumeData = managers.map((emp) => {
    const target = kpiTargets.find((t) => t.employeeId === emp.id);
    return {
      name: emp.name.split(" ")[0],
      value: parseFloat(target?.volume || "0"),
    };
  });

  const orderData = managers.map((emp) => {
    const target = kpiTargets.find((t) => t.employeeId === emp.id);
    return {
      name: emp.name.split(" ")[0],
      value: target?.orderCount || 0,
    };
  });

  const acbData = managers.map((emp) => {
    const target = kpiTargets.find((t) => t.employeeId === emp.id);
    return {
      name: emp.name.split(" ")[0],
      value: parseFloat(target?.acb || "0"),
    };
  });

  const donutData = [
    { name: "Директор", value: 25 },
    { name: "Ком. Директор", value: 20 },
    { name: "Менеджеры", value: 30 },
    { name: "Супервайзеры", value: 15 },
    { name: "Агенты", value: 10 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">KPI Аналитика</h3>
      </div>

      <Tabs value="revenue" onValueChange={() => {}}>
        <TabsList>
          <TabsTrigger value="revenue">Выручка</TabsTrigger>
          <TabsTrigger value="volume">Объем</TabsTrigger>
          <TabsTrigger value="orders">Заказы</TabsTrigger>
          <TabsTrigger value="acb">АКБ</TabsTrigger>
          <TabsTrigger value="distribution">Распределение</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Распределение выручки по менеджерам</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), "Сумма"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="volume">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Распределение объема</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [formatNumber(Number(value)), "Объем"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Распределение заказов</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={orderData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value) => [formatNumber(Number(value)), "Заказы"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acb">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Распределение АКБ</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={acbData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    formatter={(value) => [formatCurrency(Number(value)), "АКБ"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                  />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Распределение по ролям</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
