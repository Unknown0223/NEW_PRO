"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

type Emp = {
  user_id: number;
  fio: string;
  role: string;
  branch: string | null;
  login: string;
  code: string | null;
  direction: string | null;
  worked_days: number;
  absent_days: number;
  vacation_days: number;
  sick_days: number;
  trip_days: number;
  late_minutes: number;
  late_days: number;
  early_leave_minutes: number;
  overtime_hours: number;
};

type GroupRow = {
  employees: number;
  worked_days: number;
  absent_days: number;
  vacation_days: number;
  sick_days: number;
  trip_days: number;
  late_minutes: number;
  late_days: number;
  overtime_hours: number;
  people: Emp[];
};

type AnalyticsDto = {
  month: string;
  total_employees: number;
  total_worked_days: number;
  total_absent_days: number;
  total_vacation_days: number;
  total_sick_days: number;
  total_late_minutes: number;
  total_overtime_hours: number;
  by_branch: Array<GroupRow & { branch: string }>;
  by_role: Array<GroupRow & { role: string }>;
  employees: Emp[];
};

function EmployeeTable({ rows }: { rows: Emp[] }) {
  if (rows.length === 0) {
    return <p className="px-2 py-3 text-xs text-muted-foreground">Нет сотрудников в этой группе.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-left text-[11px]">
        <thead className="bg-muted/60 text-[10px] uppercase text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">Сотрудник</th>
            <th className="px-2 py-1.5">Роль / филиал</th>
            <th className="px-2 py-1.5">Код</th>
            <th className="px-2 py-1.5">Направление</th>
            <th className="px-2 py-1.5">Отраб.</th>
            <th className="px-2 py-1.5">Прогул</th>
            <th className="px-2 py-1.5">Отпуск</th>
            <th className="px-2 py-1.5">Больн.</th>
            <th className="px-2 py-1.5">Команд.</th>
            <th className="px-2 py-1.5">Опозд. дн / мин</th>
            <th className="px-2 py-1.5">Ранний уход</th>
            <th className="px-2 py-1.5">Сверхур.</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((e) => (
            <tr key={e.user_id}>
              <td className="px-2 py-1.5 font-semibold">
                {e.fio}
                <div className="font-normal text-muted-foreground">{e.login}</div>
              </td>
              <td className="px-2 py-1.5">
                {e.role}
                <div className="text-muted-foreground">{e.branch ?? "—"}</div>
              </td>
              <td className="px-2 py-1.5 font-mono">{e.code ?? "—"}</td>
              <td className="px-2 py-1.5">{e.direction ?? "—"}</td>
              <td className="px-2 py-1.5 text-emerald-700">{e.worked_days}</td>
              <td className="px-2 py-1.5 text-rose-700">{e.absent_days}</td>
              <td className="px-2 py-1.5">{e.vacation_days}</td>
              <td className="px-2 py-1.5">{e.sick_days}</td>
              <td className="px-2 py-1.5">{e.trip_days}</td>
              <td className="px-2 py-1.5 text-amber-700">
                {e.late_days} дн · {e.late_minutes} мин
              </td>
              <td className="px-2 py-1.5">{e.early_leave_minutes} мин</td>
              <td className="px-2 py-1.5 text-sky-700">{e.overtime_hours} ч</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExpandGroupTable<T extends GroupRow>({
  title,
  rows,
  labelOf,
  keyOf
}: {
  title: string;
  rows: T[];
  labelOf: (row: T) => string;
  keyOf: (row: T) => string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold">{title}</h2>
      <p className="mb-3 text-[11px] text-muted-foreground">Отметьте строку — под ней откроется детальный список сотрудников.</p>
      <table className="w-full text-left text-xs">
        <thead className="border-b bg-muted/50 text-[11px] uppercase text-muted-foreground">
          <tr>
            <th className="px-2.5 py-2 w-8"> </th>
            <th className="px-2.5 py-2">{title === "По ролям" ? "Роль" : "Филиал"}</th>
            <th className="px-2.5 py-2">Сотр.</th>
            <th className="px-2.5 py-2">Отработано</th>
            <th className="px-2.5 py-2">Прогулы</th>
            <th className="px-2.5 py-2">Отпуск / больн.</th>
            <th className="px-2.5 py-2">Опоздания</th>
            <th className="px-2.5 py-2">Сверхур.</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const key = keyOf(row);
            const expanded = open.has(key);
            return (
              <Fragment key={key}>
                <tr className={cn(expanded && "bg-primary/5")}>
                  <td className="px-2.5 py-2">
                    <input type="checkbox" checked={expanded} onChange={() => toggle(key)} aria-label={`Показать сотрудников: ${labelOf(row)}`} />
                  </td>
                  <td className="px-2.5 py-2 font-semibold">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => toggle(key)}>
                      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      {labelOf(row)}
                    </button>
                  </td>
                  <td className="px-2.5 py-2">{row.employees}</td>
                  <td className="px-2.5 py-2 text-emerald-700">{row.worked_days}</td>
                  <td className="px-2.5 py-2 text-rose-700">{row.absent_days}</td>
                  <td className="px-2.5 py-2">
                    {row.vacation_days} / {row.sick_days}
                  </td>
                  <td className="px-2.5 py-2 text-amber-700">
                    {row.late_days} дн · {row.late_minutes} мин
                  </td>
                  <td className="px-2.5 py-2 text-sky-700">{row.overtime_hours} ч</td>
                </tr>
                {expanded ? (
                  <tr>
                    <td colSpan={8} className="bg-muted/20 px-3 py-3">
                      <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                        Сотрудники · {labelOf(row)} ({row.people.length})
                      </div>
                      <EmployeeTable rows={row.people} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TabelAnalyticsWorkspace() {
  const { tenantSlug } = useAuthStore();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [branch, setBranch] = useState("");
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(true);

  const analyticsQ = useQuery({
    queryKey: ["tabel", "analytics", tenantSlug, month],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: AnalyticsDto }>(`/api/${tenantSlug}/tabel/analytics`, { params: { month } });
      return data.data;
    }
  });

  const d = analyticsQ.data;
  const branches = useMemo(() => (d?.by_branch ?? []).map((b) => b.branch), [d]);
  const roles = useMemo(() => (d?.by_role ?? []).map((r) => r.role), [d]);

  const byBranch = useMemo(() => {
    return (d?.by_branch ?? [])
      .filter((b) => !branch || b.branch === branch)
      .map((b) => ({
        ...b,
        people: b.people.filter((e) => (!role || e.role === role) && matchEmp(e, search))
      }))
      .filter((b) => !search || b.people.length > 0);
  }, [d, branch, role, search]);

  const byRole = useMemo(() => {
    return (d?.by_role ?? [])
      .filter((r) => !role || r.role === role)
      .map((r) => ({
        ...r,
        people: r.people.filter((e) => (!branch || (e.branch || "Без филиала") === branch) && matchEmp(e, search))
      }))
      .filter((r) => !search || r.people.length > 0);
  }, [d, branch, role, search]);

  const people = useMemo(() => {
    return (d?.employees ?? []).filter(
      (e) => (!branch || (e.branch || "Без филиала") === branch) && (!role || e.role === role) && matchEmp(e, search)
    );
  }, [d, branch, role, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold">Статистика посещаемости и дисциплины</h1>
          <p className="text-xs text-muted-foreground">
            Сводка по филиалам и ролям. Галочка в строке открывает полный список сотрудников с деталями.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Месяц</label>
            <Input type="month" className="h-9 w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Филиал</label>
            <select className="h-9 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-sm" value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Все филиалы</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Роль</label>
            <select className="h-9 w-full min-w-[140px] rounded-md border border-input bg-background px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Все роли</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Сотрудник</label>
            <Input className="h-9" placeholder="ФИО, логин, код…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <Card label="Сотрудников" value={people.length || d?.total_employees || 0} />
        <Card label="Отработано" value={d?.total_worked_days ?? 0} color="text-emerald-700" />
        <Card label="Прогулов" value={d?.total_absent_days ?? 0} color="text-rose-700" />
        <Card label="Отпуск / больн." value={`${d?.total_vacation_days ?? 0} / ${d?.total_sick_days ?? 0}`} />
        <Card label="Опоздания" value={`${d?.total_late_minutes ?? 0} мин`} color="text-amber-700" />
        <Card label="Сверхурочно" value={`${d?.total_overtime_hours ?? 0} ч`} color="text-sky-700" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ExpandGroupTable title="По филиалам" rows={byBranch} labelOf={(r) => r.branch} keyOf={(r) => `b:${r.branch}`} />
        <ExpandGroupTable title="По ролям" rows={byRole} labelOf={(r) => r.role} keyOf={(r) => `r:${r.role}`} />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <label className="mb-3 flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          По сотрудникам — детальный список ({people.length})
        </label>
        {showAll ? <EmployeeTable rows={people} /> : <p className="text-xs text-muted-foreground">Отметьте галочку, чтобы открыть полный список.</p>}
      </div>
    </div>
  );
}

function matchEmp(e: Emp, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return `${e.fio} ${e.login} ${e.code ?? ""} ${e.role} ${e.branch ?? ""}`.toLowerCase().includes(s);
}

function Card({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-bold", color)}>{value}</div>
    </div>
  );
}
