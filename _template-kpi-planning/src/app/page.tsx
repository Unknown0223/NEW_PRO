"use client";

import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { PlanningTable } from "@/components/planning-table";
import { TotalsSection } from "@/components/totals-section";
import { Loader2 } from "lucide-react";

interface PlanningData {
  tradeDirections: Array<{
    id: number;
    name: string;
    code: string;
    brand: string | null;
    employeeCount: number | null;
  }>;
  kpiGroups: Array<{
    id: number;
    name: string;
    tradeDirectionId: number;
    totalCost: string | null;
    totalVolume: string | null;
    totalOrders: number | null;
    completionPercent: string | null;
    status: string | null;
  }>;
  employees: Array<{
    id: number;
    name: string;
    code: string;
    role: string;
    parentId: number | null;
    avatar: string | null;
  }>;
  plans: Array<{
    id: number;
    month: number;
    year: number;
    tradeDirectionId: number;
    kpiGroupId: number;
    status: string | null;
  }>;
  kpiTargets: Array<{
    id: number;
    planId: number;
    employeeId: number;
    cost: string | null;
    count: string | null;
    volume: string | null;
    acb: string | null;
    orderCount: number | null;
    comment: string | null;
    status: string | null;
    lastUpdated: Date | string | null;
    updatedBy: number | null;
  }>;
  approvals: Array<{
    id: number;
    planId: number;
    step: number;
    approverId: number;
    approverRole: string;
    status: string;
    comment: string | null;
    createdAt: Date | string | null;
    actedAt: Date | string | null;
  }>;
}

export default function HomePage() {
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(5);
  const [year, setYear] = useState(2026);
  const [tradeDirection, setTradeDirection] = useState("GIGA");
  const [searchQuery, setSearchQuery] = useState("");
  const [seeded, setSeeded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("month", String(month));
      params.set("year", String(year));

      const res = await fetch(`/api/planning-center?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (seeded) {
      fetchData();
    }
  }, [fetchData, seeded]);

  useEffect(() => {
    fetch("/api/seed", { method: "POST" })
      .then(() => {
        setSeeded(true);
      })
      .catch(() => {
        setSeeded(true);
      });
  }, []);

  const handleUpdateTarget = useCallback(
    async (target: any, field: string, value: string) => {
      try {
        const res = await fetch("/api/kpi-targets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: target.id,
            [field]: value,
            oldValue: { [field]: target[field] },
            userName: "System Admin",
          }),
        });
        if (res.ok) fetchData();
      } catch (e) {
        console.error(e);
      }
    },
    [fetchData]
  );

  const handleUpdateStatus = useCallback(
    async (target: any, status: string) => {
      try {
        const res = await fetch("/api/kpi-targets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: target.id,
            status,
            oldValue: { status: target.status },
            userName: "System Admin",
          }),
        });
        if (res.ok) fetchData();
      } catch (e) {
        console.error(e);
      }
    },
    [fetchData]
  );

  const handleUpdateComment = useCallback(
    async (target: any, comment: string) => {
      try {
        const res = await fetch("/api/kpi-targets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: target.id,
            comment,
            oldValue: { comment: target.comment },
            userName: "System Admin",
          }),
        });
        if (res.ok) fetchData();
      } catch (e) {
        console.error(e);
      }
    },
    [fetchData]
  );

  const filteredGroups = data
    ? data.kpiGroups.filter((g) => {
        const dir = data.tradeDirections.find((d) => d.id === g.tradeDirectionId);
        return dir?.name === tradeDirection;
      })
    : [];

  const filteredEmployees = data
    ? data.employees.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const tradeDirectionNames = data ? data.tradeDirections.map((d) => d.name) : ["GIGA"];

  if (loading && !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f5f6f8]">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Загрузка данных...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f5f6f8]">
      <Sidebar />
      <main className="flex-1 ml-[220px]">
        <TopBar
          month={month}
          year={year}
          tradeDirection={tradeDirection}
          tradeDirections={tradeDirectionNames}
          onMonthChange={(m, y) => {
            setMonth(m);
            setYear(y);
          }}
          onTradeDirectionChange={setTradeDirection}
          onSearch={setSearchQuery}
          onRefresh={fetchData}
        />

        <div className="p-4 space-y-4">
          {data && (
            <PlanningTable
              employees={filteredEmployees}
              kpiGroups={filteredGroups}
              kpiTargets={data.kpiTargets}
              plans={data.plans}
              onUpdateTarget={handleUpdateTarget}
              onUpdateStatus={handleUpdateStatus}
              onUpdateComment={handleUpdateComment}
            />
          )}

          {data && (
            <TotalsSection
              employees={data.employees}
              kpiGroups={filteredGroups}
              kpiTargets={data.kpiTargets}
              plans={data.plans}
            />
          )}

          {/* Bottom action buttons */}
          <div className="flex items-center justify-end gap-3 py-2">
            <button className="h-9 rounded-lg border border-slate-200 bg-white px-6 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Сохранить
            </button>
            <button className="h-9 rounded-lg bg-teal-600 px-6 text-sm font-medium text-white hover:bg-teal-700 transition-colors">
              Подтвердить
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
