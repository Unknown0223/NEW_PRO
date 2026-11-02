import { branchLabelLookup, branchVisibleName } from "../tenant-settings/branch-display.pure";
import { loadBranchLabelSources } from "../tenant-settings/tenant-settings.refs";
import { listTimesheetMatrix, type TimesheetRowDto } from "../timesheet/timesheet.service";

export type TabelAnalyticsEmployee = {
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

type GroupStat = {
  employees: number;
  worked_days: number;
  absent_days: number;
  vacation_days: number;
  sick_days: number;
  trip_days: number;
  late_minutes: number;
  late_days: number;
  early_leave_minutes: number;
  overtime_hours: number;
  people: TabelAnalyticsEmployee[];
};

function emptyGroup(): GroupStat {
  return {
    employees: 0,
    worked_days: 0,
    absent_days: 0,
    vacation_days: 0,
    sick_days: 0,
    trip_days: 0,
    late_minutes: 0,
    late_days: 0,
    early_leave_minutes: 0,
    overtime_hours: 0,
    people: []
  };
}

function countDays(row: TimesheetRowDto, status: string): number {
  let n = 0;
  for (const c of row.cells) if (c.status === status) n += 1;
  return n;
}

function toEmployee(r: TimesheetRowDto): TabelAnalyticsEmployee {
  return {
    user_id: r.user_id,
    fio: r.fio,
    role: r.role,
    branch: r.branch,
    login: r.login,
    code: r.code,
    direction: r.direction,
    worked_days: r.worked_days,
    absent_days: r.absent_days,
    vacation_days: countDays(r, "vacation"),
    sick_days: countDays(r, "sick"),
    trip_days: countDays(r, "trip"),
    late_minutes: r.late_minutes ?? 0,
    late_days: r.late_unexcused_days ?? 0,
    early_leave_minutes: r.early_leave_minutes ?? 0,
    overtime_hours: r.overtime_hours ?? 0
  };
}

function addToGroup(g: GroupStat, e: TabelAnalyticsEmployee): void {
  g.employees += 1;
  g.worked_days += e.worked_days;
  g.absent_days += e.absent_days;
  g.vacation_days += e.vacation_days;
  g.sick_days += e.sick_days;
  g.trip_days += e.trip_days;
  g.late_minutes += e.late_minutes;
  g.late_days += e.late_days;
  g.early_leave_minutes += e.early_leave_minutes;
  g.overtime_hours += e.overtime_hours;
  g.people.push(e);
}

function packGroup(s: GroupStat) {
  return {
    employees: s.employees,
    worked_days: s.worked_days,
    absent_days: s.absent_days,
    vacation_days: s.vacation_days,
    sick_days: s.sick_days,
    trip_days: s.trip_days,
    late_minutes: s.late_minutes,
    late_days: s.late_days,
    early_leave_minutes: s.early_leave_minutes,
    overtime_hours: Math.round(s.overtime_hours * 100) / 100,
    people: s.people.sort((a, b) => a.fio.localeCompare(b.fio, "ru"))
  };
}

export async function getTabelAnalytics(tenantId: number, month: string, branch?: string) {
  const [matrix, sources] = await Promise.all([
    listTimesheetMatrix(tenantId, {
      month,
      branch: branch?.trim() || undefined
    }),
    loadBranchLabelSources(tenantId)
  ]);
  const lookup = branchLabelLookup(sources);

  const byBranch = new Map<string, GroupStat>();
  const byRole = new Map<string, GroupStat>();
  const employees: TabelAnalyticsEmployee[] = [];
  const totals = emptyGroup();

  for (const r of matrix.rows) {
    const e = toEmployee(r);
    e.branch = branchVisibleName(e.branch, lookup);
    employees.push(e);
    addToGroup(totals, e);
    const bKey = e.branch || "Без филиала";
    const rKey = e.role || "other";
    const bStat = byBranch.get(bKey) ?? emptyGroup();
    const rStat = byRole.get(rKey) ?? emptyGroup();
    addToGroup(bStat, e);
    addToGroup(rStat, e);
    byBranch.set(bKey, bStat);
    byRole.set(rKey, rStat);
  }

  employees.sort((a, b) => a.fio.localeCompare(b.fio, "ru"));

  return {
    month,
    total_employees: totals.employees,
    total_worked_days: totals.worked_days,
    total_absent_days: totals.absent_days,
    total_vacation_days: totals.vacation_days,
    total_sick_days: totals.sick_days,
    total_late_minutes: totals.late_minutes,
    total_overtime_hours: Math.round(totals.overtime_hours * 100) / 100,
    by_branch: [...byBranch.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([name, s]) => ({ branch: name, ...packGroup(s) })),
    by_role: [...byRole.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([role, s]) => ({ role, ...packGroup(s) })),
    employees
  };
}
