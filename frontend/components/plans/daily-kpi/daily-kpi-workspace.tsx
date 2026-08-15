"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  RefreshCw
} from "lucide-react";
import { PLANNING_MONTHS } from "@/components/plans/setup/planning-utils";
import { getUserFacingError } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { workRegionTodayYmd } from "./daily-kpi-day-utils";
import {
  dailyKpiDayKeys,
  fetchDailyKpiDayMatrix,
  fetchDailyKpiOverview
} from "./daily-kpi-api";
import { DailyKpiDayTable } from "./daily-kpi-day-table";
import { DailyKpiMonthTable } from "./daily-kpi-month-table";
import { fmtMoney, fmtPct, formatDayLabel } from "./daily-kpi-format";

function shiftDay(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function shiftMonth(month: number, year: number, delta: number): { month: number; year: number } {
  const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { month: dt.getUTCMonth() + 1, year: dt.getUTCFullYear() };
}

function monthPeriodLabel(month: number, year: number): string {
  const name = PLANNING_MONTHS[month - 1] ?? String(month);
  return `${name} ${year}`;
}

export function DailyKpiWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const searchParams = useSearchParams();
  const todayYmd = useMemo(() => workRegionTodayYmd(), []);

  const [day, setDay] = useState(() => {
    const raw = searchParams.get("day");
    if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    if (month && year) {
      const m = Number.parseInt(month, 10);
      const y = Number.parseInt(year, 10);
      if (Number.isFinite(m) && Number.isFinite(y)) {
        const today = todayYmd;
        if (today.startsWith(`${y}-${String(m).padStart(2, "0")}`)) return today;
        return `${y}-${String(m).padStart(2, "0")}-01`;
      }
    }
    return todayYmd;
  });

  const monthNum = Number.parseInt(day.slice(5, 7), 10);
  const yearNum = Number.parseInt(day.slice(0, 4), 10);

  const [directionId, setDirectionId] = useState<number | null>(() => {
    const raw = searchParams.get("direction_id");
    const n = Number.parseInt(raw ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  });

  const overviewQ = useQuery({
    queryKey: dailyKpiDayKeys.overview(tenantSlug, monthNum, yearNum, directionId),
    queryFn: () =>
      fetchDailyKpiOverview(tenantSlug, {
        month: monthNum,
        year: yearNum,
        directionId
      }),
    staleTime: 20_000
  });

  const matrixQ = useQuery({
    queryKey: dailyKpiDayKeys.matrix(tenantSlug, day, directionId),
    queryFn: () => fetchDailyKpiDayMatrix(tenantSlug, { day, directionId }),
    staleTime: 20_000
  });

  const tradeDirections =
    overviewQ.data?.trade_directions ?? matrixQ.data?.trade_directions ?? [];

  useEffect(() => {
    if (tradeDirections.length === 0) return;
    if (directionId == null || !tradeDirections.some((d) => d.id === directionId)) {
      setDirectionId(tradeDirections[0]!.id);
    }
  }, [tradeDirections, directionId]);

  const links = overviewQ.data?.links ?? matrixQ.data?.links;
  const loading = overviewQ.isLoading && matrixQ.isLoading;
  const error = overviewQ.error ?? matrixQ.error;
  const overview = overviewQ.data;
  const matrix = matrixQ.data;

  const refetchAll = () => {
    void overviewQ.refetch();
    void matrixQ.refetch();
  };

  const goMonth = (delta: number) => {
    const next = shiftMonth(monthNum, yearNum, delta);
    const prefix = `${next.year}-${String(next.month).padStart(2, "0")}`;
    setDay((prev) => {
      if (prev.startsWith(prefix)) return prev;
      if (todayYmd.startsWith(prefix)) return todayYmd;
      return `${prefix}-01`;
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Дневные KPI планы</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Месячный обзор по агентам и детальная таблица по выбранному дню (KPI группы)
            </p>
          </div>
          {links ? (
            <div className="flex flex-wrap gap-2">
              <RelatedLink href={links.setup} label="Установка планов" />
              <RelatedLink href={links.workdays} label="Рабочие дни" />
              <RelatedLink href={links.kpi_groups} label="Группы KPI" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] border-x border-slate-200 px-3 text-center text-sm font-semibold text-slate-800">
              {monthPeriodLabel(monthNum, yearNum)}
            </span>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              title="Следующий месяц"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setDay((d) => shiftDay(d, -1))}
              className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              title="Предыдущий день"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="flex items-center gap-1.5 border-x border-slate-200 px-2">
              <Calendar className="h-3.5 w-3.5 text-teal-600" />
              <input
                type="date"
                value={day}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setDay(v);
                }}
                className="h-9 border-0 bg-transparent text-sm font-medium text-slate-800 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setDay((d) => shiftDay(d, 1))}
              className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              title="Следующий день"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setDay(todayYmd)}
            className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Сегодня
          </button>

          <select
            value={directionId ?? ""}
            onChange={(e) => {
              const id = Number(e.target.value);
              setDirectionId(Number.isFinite(id) && id > 0 ? id : null);
            }}
            className="h-9 min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-teal-500"
          >
            {tradeDirections.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={refetchAll}
            disabled={overviewQ.isFetching || matrixQ.isFetching}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-teal-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                (overviewQ.isFetching || matrixQ.isFetching) && "animate-spin"
              )}
            />
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {getUserFacingError(error)}
        </div>
      ) : null}

      {loading && !overview && !matrix ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Загрузка…
        </div>
      ) : (
        <>
          {overview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="План месяца"
                  value={fmtMoney(overview.totals.month_plan_sum)}
                  hint={monthPeriodLabel(monthNum, yearNum)}
                />
                <StatCard
                  label="Факт месяца"
                  value={fmtMoney(overview.totals.month_fact_sum)}
                  hint={`Исполнение ${fmtPct(overview.totals.month_execution_pct)}`}
                />
                <StatCard
                  label="План сегодня"
                  value={fmtMoney(overview.totals.today_plan_sum)}
                  hint={`Факт ${fmtMoney(overview.totals.today_fact_sum)}`}
                />
                <StatCard
                  label="Агенты"
                  value={String(overview.totals.agents)}
                  hint={`${overview.totals.agents_with_plans} с планом`}
                />
              </div>
              <DailyKpiMonthTable
                data={overview}
                periodLabel={monthPeriodLabel(monthNum, yearNum)}
                onPickDay={(ymd) => setDay(ymd)}
              />
            </>
          ) : overviewQ.isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Месячная таблица…
            </div>
          ) : null}

          {matrix ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="План дня"
                  value={fmtMoney(matrix.totals.day_plan_sum)}
                  hint={formatDayLabel(matrix.day)}
                />
                <StatCard
                  label="Продажа"
                  value={fmtMoney(matrix.totals.sales_sum)}
                  hint={`Возврат ${fmtMoney(matrix.totals.returns_sum)}`}
                />
                <StatCard
                  label="Факт"
                  value={fmtMoney(matrix.totals.fact_sum)}
                  hint={`Исполнение ${fmtPct(matrix.totals.execution_pct)}`}
                />
                <StatCard
                  label="Группы KPI"
                  value={String(matrix.kpi_groups.length)}
                  hint={`${matrix.totals.agents} агент(ов)`}
                />
              </div>
              <DailyKpiDayTable data={matrix} dayLabel={formatDayLabel(matrix.day)} />
            </>
          ) : matrixQ.isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Таблица дня…
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function RelatedLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
    >
      {label}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </Link>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
    </div>
  );
}
