"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { timesheetRoleLabel } from "@/components/timesheet/timesheet-shared";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { branchLabelLookup, branchVisibleName, type BranchRefRow } from "@/lib/branch-options";
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

function presentEmp(e: Emp, lookup: Map<string, string>): Emp {
  return {
    ...e,
    role: timesheetRoleLabel(e.role),
    branch: branchVisibleName(e.branch, lookup) ?? "Без филиала"
  };
}

type SortDir = "asc" | "desc";

function SortTh({
  label,
  active,
  dir,
  onSort
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className="px-2 py-1.5">
      <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap uppercase hover:text-foreground" onClick={onSort}>
        {label}
        <Icon className={cn("size-3", active ? "text-teal-600" : "text-muted-foreground/50")} aria-hidden />
      </button>
    </th>
  );
}

function toggleSort<K extends string>(current: { key: K; dir: SortDir } | null, key: K): { key: K; dir: SortDir } {
  if (current?.key !== key) return { key, dir: "asc" };
  return { key, dir: current.dir === "asc" ? "desc" : "asc" };
}

function cmp(a: string | number, b: string | number, dir: SortDir): number {
  const n = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ru");
  return dir === "asc" ? n : -n;
}

function sumPeople(rows: Emp[]) {
  return rows.reduce(
    (acc, e) => {
      acc.worked_days += e.worked_days;
      acc.absent_days += e.absent_days;
      acc.vacation_days += e.vacation_days;
      acc.sick_days += e.sick_days;
      acc.late_minutes += e.late_minutes;
      acc.overtime_hours += e.overtime_hours;
      return acc;
    },
    { worked_days: 0, absent_days: 0, vacation_days: 0, sick_days: 0, late_minutes: 0, overtime_hours: 0 }
  );
}

function groupPeople(rows: Emp[], keyOf: (e: Emp) => string): Array<GroupRow & { label: string }> {
  const map = new Map<string, Emp[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ru"))
    .map(([label, people]) => {
      const totals = sumPeople(people);
      return {
        label,
        employees: people.length,
        ...totals,
        trip_days: people.reduce((n, e) => n + e.trip_days, 0),
        late_days: people.reduce((n, e) => n + e.late_days, 0),
        people
      };
    });
}

function RoleGroups({ people }: { people: Emp[] }) {
  const groups = useMemo(() => groupPeople(people, (e) => e.role), [people]);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const expanded = open === group.label;
        return (
          <div key={group.label} className="overflow-hidden rounded-lg border bg-background">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
              onClick={() => setOpen(expanded ? null : group.label)}
            >
              {expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate font-semibold">{group.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{group.employees} сотр.</span>
              <span className="shrink-0 tabular-nums text-emerald-700">{group.worked_days}</span>
              <span className="shrink-0 tabular-nums text-rose-700">{group.absent_days} прог.</span>
            </button>
            {expanded ? (
              <div className="border-t p-2">
                <EmployeeTable rows={group.people} hideRole />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function EmployeeTable({ rows, hideRole = false }: { rows: Emp[]; hideRole?: boolean }) {
  type K = "fio" | "role" | "code" | "direction" | "worked" | "absent" | "vacation" | "sick" | "trip" | "late" | "early" | "overtime";
  const [sort, setSort] = useState<{ key: K; dir: SortDir } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const value = (e: Emp): string | number => {
      switch (sort.key) {
        case "fio": return e.fio;
        case "role": return `${e.role} ${e.branch ?? ""}`;
        case "code": return e.code ?? "";
        case "direction": return e.direction ?? "";
        case "worked": return e.worked_days;
        case "absent": return e.absent_days;
        case "vacation": return e.vacation_days;
        case "sick": return e.sick_days;
        case "trip": return e.trip_days;
        case "late": return e.late_minutes;
        case "early": return e.early_leave_minutes;
        default: return e.overtime_hours;
      }
    };
    return [...rows].sort((a, b) => cmp(value(a), value(b), sort.dir));
  }, [rows, sort]);
  if (rows.length === 0) {
    return <p className="px-2 py-3 text-xs text-muted-foreground">Нет сотрудников в этой группе.</p>;
  }
  const th = (label: string, key: K) => (
    <SortTh label={label} active={sort?.key === key} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, key))} />
  );
  return (
    <div className="overflow-x-auto rounded-lg border bg-background">
      <table className="w-full min-w-[720px] text-left text-[11px]">
        <thead className="bg-muted/60 text-[10px] text-muted-foreground">
          <tr>
            {th("Сотрудник", "fio")}
            {hideRole ? null : th("Роль / филиал", "role")}
            {th("Код", "code")}
            {th("Направление", "direction")}
            {th("Отраб.", "worked")}
            {th("Прогул", "absent")}
            {th("Отпуск", "vacation")}
            {th("Больн.", "sick")}
            {th("Команд.", "trip")}
            {th("Опозд. дн / мин", "late")}
            {th("Ранний уход", "early")}
            {th("Сверхур.", "overtime")}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((e) => (
            <tr key={e.user_id}>
              <td className="whitespace-nowrap px-2 py-1.5 font-semibold">{e.fio}</td>
              {hideRole ? null : (
                <td className="whitespace-nowrap px-2 py-1.5">
                  {e.role}
                  <div className="text-muted-foreground">{e.branch ?? "—"}</div>
                </td>
              )}
              <td className="whitespace-nowrap px-2 py-1.5 font-mono">{e.code ?? "—"}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{e.direction ?? "—"}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-emerald-700">{e.worked_days}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-rose-700">{e.absent_days}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{e.vacation_days}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{e.sick_days}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{e.trip_days}</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-amber-700">
                {e.late_days} дн · {e.late_minutes} мин
              </td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{e.early_leave_minutes} мин</td>
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-sky-700">{e.overtime_hours} ч</td>
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
  type K = "label" | "employees" | "worked" | "absent" | "leave" | "late" | "overtime";
  const [sort, setSort] = useState<{ key: K; dir: SortDir } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const value = (row: T): string | number => {
      switch (sort.key) {
        case "label": return labelOf(row);
        case "employees": return row.employees;
        case "worked": return row.worked_days;
        case "absent": return row.absent_days;
        case "leave": return row.vacation_days + row.sick_days;
        case "late": return row.late_minutes;
        default: return row.overtime_hours;
      }
    };
    return [...rows].sort((a, b) => cmp(value(a), value(b), sort.dir));
  }, [rows, sort, labelOf]);
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
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="border-b bg-muted/50 text-[11px] text-muted-foreground">
          <tr>
            <th className="px-2.5 py-2 w-8"> </th>
            <SortTh label={title === "По ролям" ? "Роль" : "Филиал"} active={sort?.key === "label"} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, "label"))} />
            <SortTh label="Сотр." active={sort?.key === "employees"} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, "employees"))} />
            <SortTh label="Отработано" active={sort?.key === "worked"} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, "worked"))} />
            <SortTh label="Прогулы" active={sort?.key === "absent"} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, "absent"))} />
            <SortTh label="Отпуск / больн." active={sort?.key === "leave"} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, "leave"))} />
            <SortTh label="Опоздания" active={sort?.key === "late"} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, "late"))} />
            <SortTh label="Сверхур." active={sort?.key === "overtime"} dir={sort?.dir ?? "asc"} onSort={() => setSort((s) => toggleSort(s, "overtime"))} />
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((row) => {
            const key = keyOf(row);
            const expanded = open.has(key);
            return (
              <Fragment key={key}>
                <tr className={cn(expanded && "bg-primary/5")}>
                  <td className="px-2.5 py-2">
                    <input type="checkbox" checked={expanded} onChange={() => toggle(key)} aria-label={`Показать сотрудников: ${labelOf(row)}`} />
                  </td>
                  <td className="px-2.5 py-2 font-semibold">
                    <button type="button" className="inline-flex items-center gap-1 whitespace-nowrap" onClick={() => toggle(key)}>
                      {expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
                      {labelOf(row)}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 tabular-nums">{row.employees}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-emerald-700">{row.worked_days}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-rose-700">{row.absent_days}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 tabular-nums">
                    {row.vacation_days} / {row.sick_days}
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-amber-700">
                    {row.late_days} дн · {row.late_minutes} мин
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 tabular-nums text-sky-700">{row.overtime_hours} ч</td>
                </tr>
                {expanded ? (
                  <tr>
                    <td colSpan={8} className="bg-muted/20 px-3 py-3">
                      <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                        Сотрудники · {labelOf(row)} ({row.people.length})
                      </div>
                      {title === "По филиалам" ? <RoleGroups people={row.people} /> : <EmployeeTable rows={row.people} />}
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
  const [listBranches, setListBranches] = useState<string[]>([]);
  const [listRoles, setListRoles] = useState<string[]>([]);
  const [listNames, setListNames] = useState<string[]>([]);

  const analyticsQ = useQuery({
    queryKey: ["tabel", "analytics", tenantSlug, month],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ data: AnalyticsDto }>(`/api/${tenantSlug}/tabel/analytics`, { params: { month } });
      return data.data;
    }
  });

  const profileQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "tabel-analytics-branches"],
    enabled: Boolean(tenantSlug),
    queryFn: async () => {
      const { data } = await api.get<{ references?: { branches?: BranchRefRow[] } }>(`/api/${tenantSlug}/settings/profile`);
      return data.references?.branches ?? [];
    }
  });
  const lookup = useMemo(() => branchLabelLookup(profileQ.data ?? []), [profileQ.data]);

  const d = analyticsQ.data;
  const presented = useMemo(() => (d?.employees ?? []).map((e) => presentEmp(e, lookup)), [d, lookup]);
  const branches = useMemo(() => [...new Set(presented.map((e) => e.branch ?? "Без филиала"))].sort((a, b) => a.localeCompare(b, "ru")), [presented]);
  const roles = useMemo(() => [...new Set(presented.map((e) => e.role))].sort((a, b) => a.localeCompare(b, "ru")), [presented]);

  const people = useMemo(() => {
    return presented.filter(
      (e) => (!branch || (e.branch || "Без филиала") === branch) && (!role || e.role === role) && matchEmp(e, search)
    );
  }, [presented, branch, role, search]);

  const totals = useMemo(() => sumPeople(people), [people]);
  const byBranch = useMemo(() => groupPeople(people, (e) => e.branch || "Без филиала"), [people]);
  const byRole = useMemo(() => groupPeople(people, (e) => e.role), [people]);
  const rating = useMemo(
    () =>
      [...people]
        .filter((e) => e.absent_days > 0 || e.late_minutes > 0)
        .sort((a, b) => b.absent_days - a.absent_days || b.late_minutes - a.late_minutes)
        .slice(0, 10),
    [people]
  );

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
        <Card label="Сотрудников" value={people.length} />
        <Card label="Отработано" value={totals.worked_days} color="text-emerald-700" />
        <Card label="Прогулов" value={totals.absent_days} color="text-rose-700" />
        <Card label="Отпуск / больн." value={`${totals.vacation_days} / ${totals.sick_days}`} />
        <Card label="Опоздания" value={`${totals.late_minutes} мин`} color="text-amber-700" />
        <Card label="Сверхурочно" value={`${Math.round(totals.overtime_hours * 100) / 100} ч`} color="text-sky-700" />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Рейтинг дисциплины</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">Сначала те, у кого больше прогулов, затем опозданий. Показаны первые 10.</p>
        {rating.length === 0 ? (
          <p className="text-xs text-muted-foreground">За этот месяц прогулов и опозданий нет.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b text-[11px] text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5 uppercase">Сотрудник</th>
                <th className="px-2 py-1.5 uppercase">Филиал</th>
                <th className="px-2 py-1.5 uppercase">Прогулы</th>
                <th className="px-2 py-1.5 uppercase">Опоздания</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rating.map((e, index) => (
                <tr key={e.user_id}>
                  <td className="px-2 py-1.5">{index + 1}</td>
                  <td className="px-2 py-1.5 font-semibold">{e.fio}</td>
                  <td className="px-2 py-1.5">{e.branch}</td>
                  <td className="px-2 py-1.5 text-rose-700">{e.absent_days}</td>
                  <td className="px-2 py-1.5 text-amber-700">{e.late_minutes} мин</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <ExpandGroupTable title="По филиалам" rows={byBranch} labelOf={(r) => r.label} keyOf={(r) => `b:${r.label}`} />
        <ExpandGroupTable title="По ролям" rows={byRole} labelOf={(r) => r.label} keyOf={(r) => `r:${r.label}`} />
      </div>

      <DetailList presented={presented} branches={branches} roles={roles} open={showAll} onOpen={setShowAll} listBranches={listBranches} listRoles={listRoles} listNames={listNames} setListBranches={setListBranches} setListRoles={setListRoles} setListNames={setListNames} />
    </div>
  );
}

function matchEmp(e: Emp, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return `${e.fio} ${e.login} ${e.code ?? ""} ${e.role} ${e.branch ?? ""}`.toLowerCase().includes(s);
}

function DetailList({
  presented,
  branches,
  roles,
  open,
  onOpen,
  listBranches,
  listRoles,
  listNames,
  setListBranches,
  setListRoles,
  setListNames
}: {
  presented: Emp[];
  branches: string[];
  roles: string[];
  open: boolean;
  onOpen: (v: boolean) => void;
  listBranches: string[];
  listRoles: string[];
  listNames: string[];
  setListBranches: (v: string[]) => void;
  setListRoles: (v: string[]) => void;
  setListNames: (v: string[]) => void;
}) {
  const names = useMemo(() => {
    const set = new Set<string>();
    for (const e of presented) {
      if (listBranches.length > 0 && !listBranches.includes(e.branch || "Без филиала")) continue;
      if (listRoles.length > 0 && !listRoles.includes(e.role)) continue;
      if (e.fio.trim()) set.add(e.fio.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ru"));
  }, [presented, listBranches, listRoles]);
  const rows = useMemo(
    () =>
      presented.filter((e) => {
        if (listBranches.length > 0 && !listBranches.includes(e.branch || "Без филиала")) return false;
        if (listRoles.length > 0 && !listRoles.includes(e.role)) return false;
        if (listNames.length > 0 && !listNames.includes(e.fio.trim())) return false;
        return true;
      }),
    [presented, listBranches, listRoles, listNames]
  );
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <label className="mb-3 flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={open} onChange={(e) => onOpen(e.target.checked)} />
        По сотрудникам — детальный список ({rows.length})
      </label>
      <div className="mb-3 flex flex-wrap gap-2">
        <MultiPick label="Все филиалы" options={branches} selected={listBranches} onChange={setListBranches} />
        <MultiPick label="Все роли" options={roles} selected={listRoles} onChange={setListRoles} />
        <MultiPick label="Все сотрудники" options={names} selected={listNames} onChange={setListNames} />
      </div>
      {open ? <EmployeeTable rows={rows} /> : <p className="text-xs text-muted-foreground">Отметьте галочку, чтобы открыть полный список.</p>}
    </div>
  );
}

function MultiPick({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const text = selected.length === 0 ? label : selected.length === 1 ? selected[0] : `${label}: ${selected.length}`;
  return (
    <div className="relative min-w-[180px]">
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-left text-sm"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{text}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[220px] overflow-auto rounded-md border bg-card p-2 shadow-md">
          {options.length === 0 ? <p className="px-1 py-1 text-xs text-muted-foreground">Нет вариантов</p> : null}
          {options.map((opt) => {
            const on = selected.includes(opt);
            return (
              <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt])}
                />
                <span className="truncate">{opt}</span>
              </label>
            );
          })}
          <button type="button" className="mt-1 w-full rounded px-1 py-1 text-left text-xs text-muted-foreground hover:bg-muted" onClick={() => onChange([])}>
            Сбросить
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-bold", color)}>{value}</div>
    </div>
  );
}
