"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { STALE } from "@/lib/query-stale";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { FilterSelect } from "@/components/ui/filter-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type AttendanceStatus = "worked" | "absent" | "vacation" | "sick" | "holiday";
type Source = "manual" | "gps" | "mobile_login" | "auto";

type FiltersDto = {
  roles: string[];
  employees: Array<{ id: number; fio: string; role: string; login: string }>;
};

type RowDto = {
  user_id: number;
  fio: string;
  role: string;
  login: string;
  worked_days: number;
  absent_days: number;
  cells: Array<{ day: number; date: string; status: AttendanceStatus; source: Source }>;
};

type MatrixDto = {
  month: string;
  days: number[];
  rows: RowDto[];
  locked: boolean;
};

function monthNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function statusClass(s: AttendanceStatus) {
  if (s === "worked") return "bg-emerald-100 text-emerald-700";
  if (s === "absent") return "bg-rose-100 text-rose-700";
  if (s === "vacation") return "bg-sky-100 text-sky-700";
  if (s === "sick") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function statusLabel(s: AttendanceStatus) {
  if (s === "worked") return "И";
  if (s === "absent") return "Н";
  if (s === "vacation") return "О";
  if (s === "sick") return "Б";
  return "В";
}

export function TimesheetWorkspace() {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const qc = useQueryClient();

  const [month, setMonth] = useState(monthNow());
  const [role, setRole] = useState("");
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");

  const filtersQ = useQuery({
    queryKey: ["timesheet-filters", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: FiltersDto }>(`/api/${tenantSlug}/timesheet/filters`);
      return data.data;
    }
  });

  const matrixQ = useQuery({
    queryKey: ["timesheet-matrix", tenantSlug, month, role, userId],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("month", month);
      if (role) p.set("role", role);
      if (userId) p.set("user_id", userId);
      const { data } = await api.get<{ data: MatrixDto }>(`/api/${tenantSlug}/timesheet?${p.toString()}`);
      return data.data;
    }
  });

  const patchMut = useMutation({
    mutationFn: async (v: { userId: number; date: string; status: AttendanceStatus }) => {
      await api.patch(`/api/${tenantSlug}/timesheet/${v.userId}/${v.date}`, { status: v.status, source: "manual" });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["timesheet-matrix", tenantSlug] })
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const src = matrixQ.data?.rows ?? [];
    if (!q) return src;
    return src.filter((r) => `${r.fio} ${r.role} ${r.login}`.toLowerCase().includes(q));
  }, [matrixQ.data?.rows, search]);

  if (!hydrated || !tenantSlug) return <p className="text-sm text-muted-foreground">Загрузка...</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded border bg-card p-2">
        <FilterSelect emptyLabel="Должность" value={role} onChange={(e) => setRole(e.target.value)}>
          {(filtersQ.data?.roles ?? []).map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect emptyLabel="Сотрудник" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {(filtersQ.data?.employees ?? []).map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.fio}
            </option>
          ))}
        </FilterSelect>
        <Input type="month" className="h-9 w-44 text-xs" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Input className="h-9 w-56 text-xs" placeholder="Поиск" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="ghost" size="icon-sm" onClick={() => void matrixQ.refetch()}>
          <RefreshCw className={cn("size-4", matrixQ.isFetching && "animate-spin")} />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const days = matrixQ.data?.days ?? [];
            const head = ["ФИО", "Роль", ...days.map((d) => String(d).padStart(2, "0")), "Итого отработано", "Итого отсутствовал"];
            const lines = rows.map((r) => [r.fio, r.role, ...r.cells.map((c) => statusLabel(c.status)), String(r.worked_days), String(r.absent_days)]);
            const csv = [head, ...lines].map((x) => x.map((y) => `"${String(y).replaceAll("\"", "\"\"")}"`).join(";")).join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `timesheet-${month}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="mr-1 size-3.5" />
          Export
        </Button>
      </div>

      {matrixQ.data?.locked ? <p className="text-xs text-amber-600">Период заблокирован для редактирования (payroll lock).</p> : null}

      <div className="overflow-auto rounded border bg-card">
        <table className="w-full min-w-[1400px] text-xs">
          <thead className="app-table-thead sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-muted px-2 py-2 text-left">Должность</th>
              <th className="sticky left-[180px] z-20 bg-muted px-2 py-2 text-left">Сотрудник</th>
              {(matrixQ.data?.days ?? []).map((d) => (
                <th key={d} className="px-1 py-2 text-center">
                  {String(d).padStart(2, "0")}
                </th>
              ))}
              <th className="px-2 py-2 text-right">И</th>
              <th className="px-2 py-2 text-right">Н</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-t">
                <td className="sticky left-0 z-10 bg-card px-2 py-2">{r.role}</td>
                <td className="sticky left-[180px] z-10 bg-card px-2 py-2">{r.fio}</td>
                {r.cells.map((c) => (
                  <td key={c.date} className="px-1 py-1 text-center">
                    <select
                      className={cn("h-7 rounded border px-1 text-[11px]", statusClass(c.status))}
                      value={c.status}
                      disabled={Boolean(matrixQ.data?.locked) || patchMut.isPending}
                      onChange={(e) =>
                        patchMut.mutate({
                          userId: r.user_id,
                          date: c.date,
                          status: e.target.value as AttendanceStatus
                        })
                      }
                      title={`source: ${c.source}`}
                    >
                      <option value="worked">И</option>
                      <option value="absent">Н</option>
                      <option value="vacation">О</option>
                      <option value="sick">Б</option>
                      <option value="holiday">В</option>
                    </select>
                  </td>
                ))}
                <td className="px-2 py-2 text-right font-medium">{r.worked_days}</td>
                <td className="px-2 py-2 text-right font-medium">{r.absent_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
